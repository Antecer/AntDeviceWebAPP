declare let localforage: any;
declare let JSZip: any;

(async () => {
	let sleep = (millisecond: number) => new Promise((resolve) => setTimeout(resolve, millisecond));
	let getType = (T: any) => Object.prototype.toString.call(T).slice(8, -1);

	// 封装带超时的fetch
	interface fetchInfo { url: string, options?: RequestInit }
	let fetchAll = async (infolist: (string | fetchInfo)[], timeout?: number) => {
		let fetchInfos = infolist.map(info => getType(info) === 'Object' ? info as fetchInfo : { url: info as string, options: {} });
		let controller = new AbortController();
		let timeoutTimer;
		if (timeout) {
			fetchInfos.forEach(info => { info.options ||= {}; info.options.signal = controller.signal; });
			timeoutTimer = setTimeout(() => controller.abort(), timeout);
		}
		let resArray: Response[] = [];
		try {
			resArray = await Promise.all(fetchInfos.map(info => fetch(info.url, info.options)));
			clearTimeout(timeoutTimer);
		} catch (error) {
			if (controller.signal.aborted) { console.log('fetch timeout:', fetchInfos); };
		}
		return resArray;
	}

	// 加载localforage库
	let localforagejs = localStorage.getItem('localforage');
	if (!localforagejs) {
		let res = await fetch('/resources/js/localforage.min.js').then(res => res.text());
		localforagejs = res;
		window.localStorage.setItem('localforage', localforagejs);
	}
	eval(localforagejs);

	// 资源信息接口
	interface resInfo {
		dkey: string,
		path: string,
		file: string[],
		blob: any
	}

	// 资源加载函数
	let loadfiles = async (res: resInfo, callback: any) => {
		res.blob = (await localforage.getItem(res.dkey)) || {};
		res.file.forEach(async (name) => {
			if (!res.blob[name]) {
				await fetch(res.path + name).then(res => res.blob()).then(blob => {
					res.blob[name] = blob;
					localforage.setItem(res.dkey, res.blob);
				}).catch(err => console.log(`"${name}" load failed:`, err));
			}
			callback(res.blob[name], name);
		});
	};

	// 加载css库
	let styles = {
		dkey: 'StyleList',
		path: '/resources/css/',
		file: ['animate.min.css'],
		blob: {} as any
	}
	loadfiles(styles, (blob: Blob, name: string) => {
		document.head.insertAdjacentHTML('beforeend', `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(blob)}" />`);
	});

	// 加载js库
	let scripts = {
		dkey: 'ScriptList',
		path: '/resources/js/',
		file: ['jszip.min.js'],
		blob: {} as any
	}
	let JSZipReady: Boolean;
	loadfiles(scripts, (blob: Blob, name: string) => {
		blob.text().then(jstext => JSZipReady = eval(jstext));
	});

	// 加载背景图片
	let banners = {
		dkey: 'BannerList',
		path: '/resources/images/',
		file: ['banner0.jpg', 'banner1.jpg'],
		blob: {} as any
	}
	loadfiles(banners, (blob: Blob, name: string) => {
		if (name == banners.file[0]) {
			document.getElementById('backdrop')?.setAttribute('src', URL.createObjectURL(blob));
		}
	});

	// 绘制导航栏
	let navbar = {
		logo: 'AntDevice',
		tabs: {
			Home: 'fas fas-home',
			Products: 'fas fa-shopping-cart',
			Prettify: 'fas fa-palette',
			Driver: 'fas fa-download',
			Support: 'fas fa-envelope',
			ShipTo: 'fas fa-globe-asia',
		},
		DestList: {} as any,
		DestFlag: {} as any
	}
	let logoHTML = `<div class="navlogo">${navbar.logo}</div>`;
	let tabsHTML = Object.entries(navbar.tabs).map(([tab, icon]) => {
		let href = tab == 'ShipTo' ? 'javascript:;' : `#${tab}`;
		return `<a class="${icon}" href="${href}">${tab}</a>`;
	}).join('');
	document.getElementById('navbar')?.insertAdjacentHTML('beforeend', `${logoHTML}<div class="navtab">${tabsHTML}</div>`);
	document.querySelector('.navtab')?.addEventListener('click', (e) => {
		if ((e.target as HTMLInputElement).localName != 'a') return;
		if ((e.target as HTMLInputElement).textContent != 'ShipTo') {
			document.querySelector('.navtab>[selected]')?.removeAttribute('selected');
			(e.target as HTMLInputElement).setAttribute('selected', '');
			return;
		}
	});
	let urlHash = window.location.hash || '#Home';
	document.querySelector(`.navtab>a[href="${urlHash}"]`)?.setAttribute('selected', '');
	// 绘制目的地列表

	// 加载旗帜
	let flags = {
		dkey: 'FlagsList',
		path: '/resources/images/flags/',
		file: ['4x3.zip'],
		blob: {} as any
	}
	loadfiles(flags, async (blob: Blob, name: string) => {
		while (!JSZipReady) await sleep(100);
		let zip = new JSZip();
		zip.loadAsync(blob).then(async (zip: any) => {
			// 遍历zip内的文件(key=path,val=file)
			for (let file of Object.values(zip.files)) {
				navbar.DestFlag[(file as any).name.slice(0, -4).toUpperCase()] = await (file as any).async("string");
			}
		});
	});

	// 加载fontawesome6










})();