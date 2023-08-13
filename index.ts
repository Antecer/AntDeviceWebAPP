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
	let loadfiles = async (res: resInfo, callback: any, nextUpdateTime = -1, reloadCallback = false) => {
		let needUpdate = false;
		let localBlob = (await localforage.getItem(res.dkey)) || {};
		res.file.forEach(fileName => res.blob[fileName] = localBlob[fileName]);// 创建数据转储，以便过滤过时资源
		res.file.forEach((fileName) => {
			if (!res.blob[fileName]?.size || (nextUpdateTime === 0)) {
				(async () => {
					try {
						let response = await fetch(res.path + fileName);
						if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
						let blob = await response.blob();
						res.blob[fileName] = blob;
						await localforage.setItem(res.dkey, res.blob);
						callback(res.blob[fileName], fileName);
					} catch (error) {
						console.log(`Resouce load failed (${fileName}):`, error);
						return;
					}
				})();
			} else {
				needUpdate = true;
				callback(res.blob[fileName], fileName);
			}
		});
		needUpdate && (nextUpdateTime > 0) && (async () => {
			await sleep(nextUpdateTime * 1000);
			console.log(`[UpdateFilesTask] update resource:`, { dkey: res.dkey });
			loadfiles(res, reloadCallback && callback || (() => { }), 0, false);
		})();
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
		file: ['bgimg0.jpg', 'bgimg1.jpg'],
		blob: {} as any
	}
	loadfiles(banners, (blob: Blob, name: string) => {
		if (name == banners.file[0]) {
			document.getElementById('backdrop')?.setAttribute('src', URL.createObjectURL(blob));
			var meta = document.querySelector('meta[name="theme-color"]');  // 设置主题色
			meta!.setAttribute('content', '#0001');
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
	let tabsHTML = Object.entries(navbar.tabs).map(([tab, icon]) => `<a class="${icon}" href="${tab == 'ShipTo' && 'javascript:;" id="' || '#'}${tab}">${tab}</a>`).join('');
	document.getElementById('navbar')?.insertAdjacentHTML('beforeend', `${logoHTML}<div class="navtab">${tabsHTML}</div>`);
	let navtabEvent = (e: Event) => {
		let tapElement = e.target as HTMLInputElement;
		if (tapElement.localName != 'a') return;
		if (tapElement.id != 'ShipTo') {
			switch (e.type) {
				case 'mouseover':
					(tapElement.getAttribute('selected') === null) && tapElement.classList.add('animate__animated', 'animate__pulse');
					break;
				case 'mouseout':
					tapElement.classList.remove('animate__animated', 'animate__pulse');
					break;
				case 'click':
					let headerElement = document.querySelector('.header');
					if (headerElement?.classList.contains('fold')) {
						headerElement.classList.remove('fold');
					} else {
						headerElement?.classList.add('fold');
					}
					document.querySelector('.navtab>[selected]')?.removeAttribute('selected');
					tapElement.setAttribute('selected', '');
					break;
			}
		} else {
			if (e.type == 'click') {
				let destbarElement = document.getElementById('destbar') as HTMLElement;
				destbarElement.setAttribute('hidden', !(destbarElement.getAttribute('hidden') === 'true') + '');
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
		let destsHTML = navbar.DestList.SP.map((destId: string) => `<div id="${destId}" class="flag-icon flag-icon-${destId.toLowerCase()}">${navbar.DestList.en[destId]}</div>`);
		document.getElementById('destbar')?.insertAdjacentHTML('beforeend', `<div></div><div class="dests">${destsHTML.join('')}</div>`);
		if (loadShipTo) {
			document.getElementById('ShipTo')!.innerHTML = document.getElementById(loadShipTo)!.innerHTML;
			document.getElementById('ShipTo')!.className = document.getElementById(loadShipTo)!.className;
		}
	}, 0);
	document.getElementById('destbar')?.addEventListener('click', (e: Event) => {
		let selectedDest = e.target as HTMLInputElement;
		if (selectedDest.id == '') return;
		document.getElementById('ShipTo')!.innerHTML = selectedDest.innerHTML;
		document.getElementById('ShipTo')!.className = selectedDest.className;
		document.getElementById('destbar')?.setAttribute('hidden', 'true');
		loadShipTo = selectedDest.id;
		localforage.setItem('ShipTo', loadShipTo);
	});
	window.addEventListener('mouseup', (e: Event) => {
		// 指定范围外点击关闭下拉框
		if (!document.querySelector('.header')!.contains(e.target as HTMLElement)) {
			document.querySelector('.header')!.classList.add('fold');
			document.getElementById('destbar')?.setAttribute('hidden', 'true');
		}
	});

	// 加载CSS图标库
	let cssIcons = {
		dkey: 'IconList',
		path: '/resources/icons/',
		file: ['flags.zip', 'fontawesome5less.zip'],
		blob: {} as any
	}
	loadfiles(cssIcons, async (blob: Blob, name: string) => {
		while (!JSZipReady) await sleep(100);
		JSZip.loadAsync(blob).then(async (zip: any) => {
			let cssBlobs = [];
			let resBlobs = {} as any;
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
					cssBlobs.push(fileBlob.slice(0, fileBlob.size, fileType));
					continue;
				}
				resBlobs[fileName] = fileBlob.slice(0, fileBlob.size, fileType);
			}
			// 修改css内引用文件路径
			cssBlobs.forEach(async (cssBlob: Blob) => {
				let cssText = (await cssBlob.text() as any).replace(/url\([^\?#)]+/g, (match: string) => {
					if (resBlobs[match.split('/').pop()!]) {
						return `url(` + URL.createObjectURL(resBlobs[match.split('/').pop()!]);
					}
				});
				let newBlob = new Blob([cssText], { type: 'text/css' });
				let cssHTML = `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(newBlob)}" />`;
				document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
			});
		});
	});









})();