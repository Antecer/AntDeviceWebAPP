'use strict';
var g_eval = eval;
(async () => {
	window.sleep = (millisecond) => new Promise((resolve) => setTimeout(resolve, millisecond));
	while (!window.JS_Tools_Loaded) await sleep(100);
	// 加载css视觉库
	let styles = {
		dkey: 'StyleList',
		path: 'resources/css/',
		file: ['magic.min.css', 'animate.min.css'],
		blob: {},
	};
	loadLibrarys(styles);
	// 加载背景图片
	let banners = {
		dkey: 'BannerList',
		path: 'resources/images/',
		file: ['bgimg0.jpg', 'bgimg1.jpg'],
		blob: {},
	};
	loadfiles(banners, (blob, name) => {
		name == banners.file[0] && (document.body.style.backgroundImage = `url(${URL.createObjectURL(blob)})`);
	});
	// 绘制导航栏
	let navbar = {
		logo: 'AntDevice',
		tabs: {
			Home: 'fa-home',
			Products: 'fa-shopping-cart',
			Prettify: 'fa-palette',
			App: 'fa-download',
			Support: 'fa-envelope',
		},
		dest: 'fa-globe-asia',
		dests: {},
		flags: {},
	};
	let logoHTML = `<div id="navlogo" class="gradient">${navbar.logo}</div>`;
	let tabsHTML = Object.entries(navbar.tabs)
		.map(([tab, icon]) => `<a id="${tab}" class="${icon}">${tab}</a>`)
		.join('');
	let destHTML = `<a id="navdest" class="${navbar.dest} hidden"></a>`;
	document.getElementById('navbar')?.insertAdjacentHTML('beforeend', `${logoHTML}<div class="navtab hidden">${tabsHTML}</div>${destHTML}`);
	let navtabEvent = (e) => {
		let tapElement = e.target;
		if (tapElement.localName == 'a') {
			switch (e.type) {
				case 'mouseover':
					tapElement.classList.add('animate__animated', 'animate__pulse');
					break;
				case 'mouseout':
					tapElement.classList.remove('animate__animated', 'animate__pulse');
					break;
				case 'click':
					let classList = document.querySelector('.head').classList;
					classList.contains('fold') ? classList.remove('fold') : classList.add('fold');
					if (tapElement.hasAttribute('selected')) return;
					location.hash = tapElement.textContent || '#Home';
					document.querySelector('.navtab>[selected]')?.removeAttribute('selected');
					tapElement.setAttribute('selected', '');
					break;
			}
		}
	};
	let navtabElement = document.querySelector('.navtab');
	navtabElement?.addEventListener('click', navtabEvent);
	navtabElement?.addEventListener('mouseover', navtabEvent);
	navtabElement?.addEventListener('mouseout', navtabEvent);
	let urlHash = (window.location.hash || '#Home').slice(1);
	document.getElementById(urlHash)?.setAttribute('selected', '');
	if (!document.querySelector(`.navtab>[selected]`)) document.querySelector(`.navtab>a[href="#Home"]`)?.click();
	// 绘制目的地列表
	let dests = {
		dkey: 'DestList',
		path: 'resources/json/',
		file: ['destlist.json'],
		blob: {},
	};
	let selectedDestId = await localforage.getItem('navdest');
	loadfiles(
		dests,
		async (blob, name) => {
			navbar.dests = await new Response(blob).json();
			let destsHTML = navbar.dests.SP.map((destId) => (destId && `<div id="${destId}" class="fi-${destId.toLowerCase()} dest" title="${navbar.dests.en[destId] || ''}">${destId}</div>`) || `<div></div>`);
			document.getElementById('destbar').insertAdjacentHTML('beforeend', `<div class="dests">${destsHTML.join('')}</div>`);
		},
		0
	);
	// 目的地按钮点击事件
	document.getElementById('navdest').addEventListener('click', (e) => {
		let classList = document.getElementById('destbar').classList;
		classList.contains('hidden') ? classList.remove('hidden') : classList.add('hidden');
	});
	// 目的地列表点击事件
	document.getElementById('destbar').addEventListener('click', (e) => {
		let selectedDest = e.target;
		if (!selectedDest.classList.contains('dest')) return;
		document.getElementById('navdest').className = selectedDest.className;
		document.getElementById('destbar')?.classList.add('hidden');
		selectedDestId = selectedDest.id;
		localforage.setItem('navdest', selectedDestId);
	});
	// 指定范围外点击关闭下拉框
	window.addEventListener('mouseup', (e) => {
		document.querySelector('.navtab').contains(e.target) || document.querySelector('.head').classList.add('fold');
		if (document.getElementById('navdest').contains(e.target)) return;
		if (document.querySelector('.dests').contains(e.target)) return;
		document.getElementById('destbar')?.classList.add('hidden');
	});
	// 加载CSS图标库
	let cssIcons = {
		dkey: 'IconList',
		path: 'resources/icons/',
		file: ['fontawesome5less.zip', 'flag-icons-6.9.4.zip'],
		blob: {},
	};
	loadLibrarys(cssIcons, async (filename) => {
		if (filename == cssIcons.file[0]) {
			let navtab = document.querySelector('.navtab');
			navtab.onanimationend = () => navtab.classList.remove('magictime', 'slideUpReturn');
			navtab.classList.add('magictime', 'slideUpReturn');
			navtab.classList.remove('hidden');
			let navdest = document.getElementById('navdest');
			navdest.onanimationend = () => navdest.classList.remove('magictime', 'slideUpReturn');
			navdest.classList.add('magictime', 'slideUpReturn');
			navdest.classList.remove('hidden');
		}
		if (filename == cssIcons.file[1] && selectedDestId) {
			let destbar = document.getElementById('destbar');
			while (!destbar.hasChildNodes()) await sleep(100);
			destbar.classList.add('magictime', 'sliderightReturn');
			let navdest = document.getElementById('navdest');
			navdest.onanimationend = () => navdest.classList.remove('magictime', 'vanishIn');
			navdest.className = document.getElementById(selectedDestId).className;
			navdest.classList.add('magictime', 'vanishIn');
		}
	});
	// 加载页面
	const pageBody = document.querySelector('.body');
	let pages = {
		dkey: 'PageList',
		path: 'pages/',
		file: ['pages.json'],
		blob: {},
	};
	let pageList = {};
	loadfiles(pages, async (blob, name) => {
		let pageJson = await new Response(blob).json();
		pageJson.forEach(async (page) => {
			let pageName = page.name;
			pageList[pageName] = undefined;
			if (pageName != 'App') return; // debug
			let pagePath = `pages/${pageName}/${pageName.toLowerCase()}.js`;
			let pageMakeJS = await fetch(pagePath).then((res) => res.text());
			let pageElement = await eval(pageMakeJS);
			pageList[pageName] = pageElement;
			if (urlHash != pageName) {
				pageElement.classList.add('animate__fadeOutLeftBig');
			}
			pageBody.appendChild(pageElement);
		});
	});
	window.addEventListener('hashchange', (e) => {
		let newHash = (window.location.hash || '#Home').slice(1);
		let pageNameList = Object.keys(pageList);
		let selectedFlow = pageNameList.indexOf(urlHash) < pageNameList.indexOf(newHash);
		let unselectPage = pageList[urlHash];
		let onselectPage = pageList[newHash];
		unselectPage?.classList.remove('animate__fadeInLeftBig', 'animate__fadeInRightBig');
		unselectPage?.classList.add('animate__animated', `animate__fadeOut${selectedFlow ? 'Left' : 'Right'}Big`);
		onselectPage?.classList.add('animate__animated', `animate__fadeIn${selectedFlow ? 'Right' : 'Left'}Big`);
		onselectPage?.classList.remove('animate__fadeOutLeftBig', 'animate__fadeOutRightBig');
		urlHash = newHash;
	});
})();
