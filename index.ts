declare let localforage: any;
declare let JSZip: any;

(async () => {
	let sleep = (millisecond: number) => new Promise((resolve) => setTimeout(resolve, millisecond));
	let getType = (T: any) => Object.prototype.toString.call(T).slice(8, -1);

	let mimetypes = {
		'html': 'text/html',
		'css': 'text/css',
		'js': 'text/javascript',
		'json': 'application/json',
		'jpeg': 'image/jpeg',
		'jpg': 'image/jpeg',
		'png': 'image/png',
		'svg': 'image/svg+xml',
		'txt': 'text/plain',
		'mp4': 'video/mp4',
		'ttf': 'font/ttf',
		'eot': 'font/eot',
		'woff': 'font/woff',
		'woff2': 'font/woff2'
	} as any;

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
		localforagejs = await fetch('/resources/js/localforage.min.js').then(res => res.text());
		window.localStorage.setItem('localforage', localforagejs!);
	}
	eval(localforagejs!);

	// 资源信息接口
	interface resInfo {
		dkey: string,
		path: string,
		file: string[],
		blob: any
	}

	// 资源加载函数
	let loadfiles = async (res: resInfo, callback: any) => {
		let localBlob = (await localforage.getItem(res.dkey)) || {};
		res.file.forEach(name => res.blob[name] = localBlob[name]);
		res.file.forEach(async (name) => {
			if (!res.blob[name]?.size) {
				await fetch(res.path + name).then(res => res.blob()).then(blob => {
					res.blob[name] = blob;
					console.log(blob);
				}).catch(err => console.log(`"${name}" load failed:`, err));
				await localforage.setItem(res.dkey, res.blob);
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
		let cssHTML = `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(blob)}" />`;
		document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
	});

	// 加载js库
	let scripts = {
		dkey: 'ScriptList',
		path: '/resources/js/',
		file: ['jszip.min.js'],
		blob: {} as any
	}
	let JSZipReady: any;
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
			Home: 'fas fa-home',
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
		if (tab != 'ShipTo') { return `<a class="${icon}" href="#${tab}">${tab}</a>`; }
		return `<a id="${tab}" class="${icon}" href="javascript:;">${tab}</a>`;
	}).join('');
	document.getElementById('navbar')?.insertAdjacentHTML('beforeend', `${logoHTML}<div class="navtab">${tabsHTML}</div>`);
	let navtabEvent = (e: Event) => {
		if ((e.target as HTMLInputElement).localName != 'a') return;
		if ((e.target as HTMLInputElement).id != 'ShipTo') {
			switch (e.type) {
				case 'mouseover':
					(e.target as HTMLInputElement).classList.add('animate__animated', 'animate__pulse');
					break;
				case 'mouseout':
					(e.target as HTMLInputElement).classList.remove('animate__animated', 'animate__pulse');
					break;
				case 'click':
					document.querySelector('.navtab>[selected]')?.removeAttribute('selected');
					(e.target as HTMLInputElement).setAttribute('selected', '');
					break;
			}
			return;
		}
		if ((e.target as HTMLInputElement).id == 'ShipTo') {
			if (e.type == 'click') {
				let destbarElement = document.getElementById('destbar') as HTMLElement;
				destbarElement.style.display = destbarElement.style.display == 'none' ? 'flex' : 'none';
			}
		}
	}
	let navtabElement = document.querySelector('.navtab');
	navtabElement?.addEventListener('click', navtabEvent);
	navtabElement?.addEventListener('mouseover', navtabEvent);
	navtabElement?.addEventListener('mouseout', navtabEvent);
	let urlHash = window.location.hash || '#Home';
	document.querySelector(`.navtab>a[href="${urlHash}"]`)?.setAttribute('selected', '');
	if (!document.querySelector(`.navtab>[selected]`)) (document.querySelector(`.navtab>a[href="#Home"]`) as HTMLElement)?.click();
	// 绘制目的地列表
	let dests = {
		dkey: 'DestList',
		path: '/resources/json/',
		file: ['destlist.json'],
		blob: {} as any
	}
	let loadShipTo = await localforage.getItem('ShipTo');
	loadfiles(dests, async (blob: Blob, name: string) => {
		navbar.DestList = JSON.parse(await blob.text());
		let destsHTML = navbar.DestList.SP.map((name: string) => `<div id="${name}" class="flag-icon">${navbar.DestList.en[name]}</div>`);
		document.getElementById('destbar')?.insertAdjacentHTML('beforeend', `<div></div><div class="dests">${destsHTML.join('')}</div>`);
		if (loadShipTo) { 
			document.getElementById('ShipTo')!.innerHTML = document.getElementById(loadShipTo)!.innerHTML;
			document.getElementById('ShipTo')!.className = document.getElementById(loadShipTo)!.className;
		}
	});
	document.getElementById('destbar')?.addEventListener('click', (e: Event) => {
		let selectedDest = (e.target as HTMLInputElement);
		if (selectedDest.id == '') return;
		document.getElementById('ShipTo')!.innerHTML = selectedDest.innerHTML;
		document.getElementById('ShipTo')!.className = selectedDest.className;
		document.getElementById('destbar')!.style.display = 'none';
		loadShipTo = selectedDest.id;
		localforage.setItem('ShipTo', loadShipTo);
	});
	document.querySelector('.header')?.addEventListener('mouseleave', (e: Event) => {
		document.getElementById('destbar')!.style.display = 'none';
	});

	// 加载旗帜
	let flags = {
		dkey: 'FlagsList',
		path: '/resources/images/flags/',
		file: ['4x3.zip'],
		blob: {} as any
	}
	loadfiles(flags, async (blob: Blob, name: string) => {
		while (!JSZipReady) await sleep(100);
		JSZip.loadAsync(blob).then(async (zip: any) => {
			// 遍历zip内的文件(key=path,val=file)
			for (let file of Object.values(zip.files)) {
				let blob = await (file as any).async("blob");
				navbar.DestFlag[(file as any).name.slice(0, -4).toUpperCase()] = blob.slice(0, blob.size, 'image/svg+xml');
			}
			while (!navbar.DestList) await sleep(100);
			navbar.DestList.SP.forEach(async (name: string) => {
				while (!document.getElementById(name)) await sleep(100);
				document.getElementById(name)?.insertAdjacentHTML('afterbegin', `<img src="${URL.createObjectURL(navbar.DestFlag[name])}">`);
				if (loadShipTo == name) document.getElementById('ShipTo')!.innerHTML = document.getElementById(name)!.innerHTML;
			});
		});
	});

	// 加载fontawesome6
	let cssfonts = {
		dkey: 'CSSFonts',
		path: '/resources/fonts/',
		file: ['fontawesome5less.zip'],
		blob: {} as any
	}
	let fontStyleBlobs = {} as any;
	let fontFileBlobs = {} as any;
	loadfiles(cssfonts, async (blob: Blob, name: string) => {
		while (!JSZipReady) await sleep(100);
		JSZip.loadAsync(blob).then(async (zip: any) => {
			// 遍历zip内的文件(key=path,val=file)
			for (let file of Object.values(zip.files)) {
				let fileName = (file as any).name.split('/').pop();
				if (!fileName) continue;
				let fileType = mimetypes[fileName.split('.').pop()];
				if (!fileType) {
					console.log(`unknow file type：${fileName}`);
					continue;
				}
				let fileBlob = await (file as any).async("blob");
				if (fileName.endsWith('.css')) {
					fontStyleBlobs[fileName] = fileBlob.slice(0, fileBlob.size, fileType);
					continue;
				}
				fontFileBlobs[fileName] = fileBlob.slice(0, fileBlob.size, fileType);
			}
			// 修改css内字体文件路径
			let cssText = await (Object.values(fontStyleBlobs)[0] as any).text();
			cssText = cssText.replace(/url\([^\?#)]+/g, (match: string) => {
				if (fontFileBlobs[match.split('/').pop()!]) {
					return `url(` + URL.createObjectURL(fontFileBlobs[match.split('/').pop()!]);
				}
			});
			let cssBlob = new Blob([cssText], { type: 'text/css' });
			let cssHTML = `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(cssBlob)}" />`;
			document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
		});
	});










})();