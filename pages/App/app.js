'use strict';
(async () => {
	let baseURL = 'pages/App/';
	// 构建容器元素
	window.pageElement = document.createElement('div');
	window.pageElement.className = 'context';
	// 载入css样式表
	window.pageElement.insertAdjacentHTML('afterbegin', `<link rel="stylesheet" href="${baseURL}app.css" />`);

	// 元素缩放
	const transform = (selectedElement) => {
		let zoomValX = (selectedElement.parentNode.clientWidth - 20) / selectedElement.clientWidth;
		let zoomValY = (selectedElement.parentNode.clientHeight - 10) / selectedElement.clientHeight;
		let zoomVal = zoomValX < zoomValY ? zoomValX : zoomValY;
		if (zoomVal > 1) zoomVal = 1;
		selectedElement.setAttribute('style', `transform: scale(${zoomVal})`);
	};
	// 绘制键盘布局
	const drawLayout = (selectPanel) => {
		let rowList = [];
		selectPanel.layout.forEach((row) => {
			let rowClass = 'layout';
			let rowStyle = '';
			if (getType(row) == 'Object') {
				if (row.h) rowClass = `vh-${row.h}`;
				if (row.a && getType(row.a) == 'Array') row = row.a;
				if (row.t) rowStyle = `style="${row.t || ''}"`;
			}
			if (getType(row) != 'Array') {
				rowList.push(`<div class="${rowClass}" ${rowStyle}></div>`);
				return;
			}
			let domList = [];
			row.forEach((dom) => {
				var domClass = '';
				var domStyle = '';
				if (getType(dom) == 'String') {
					if (dom == 'encoder') domList.push(`<div class="keycap encoder"></div>`);
					else domList.push(`<div class="keycap">${dom.replace('\n', '<br/>')}</div>`);
					return;
				}
				if (getType(dom) == 'Object') {
					if (dom.t) domStyle = `style="${dom.t || ''}"`;
					if (dom.w) domClass += ` vw-${dom.w}`;
					if (dom.h) domClass += ` vh-${dom.h}`;
					if (dom.fx) domClass += ` offset-vw${dom.fx}`;
					if (dom.fy) domClass += ` offset-vh${dom.fy}`;
					if (dom.led) {
						domClass = `led-${dom.led}` + domClass;
						domList.push(`<div class="${domClass}" ${domStyle}></div>`);
						return;
					}
					if (dom.k && getType(dom.k) == 'String') {
						if (dom.k == 'encoder') domList.push(`<div class="keycap encoder${domClass}" ${domStyle}></div>`);
						else domList.push(`<div class="keycap${domClass}" ${domStyle}>${dom.k.replace('\n', '<br/>')}</div>`);
						return;
					}
					domList.push(`<div class="${domClass}" ${domStyle}></div>`);
				}
			});
			rowList.push(`<div class="${rowClass}" ${rowStyle}>${domList.join('')}</div>`);
		});
		var labelHtml = `<div class="typeLabel">${selectPanel.name}</div>`;
		if (selectPanel.label) {
			var labelText = selectPanel.label.v || selectPanel.name;
			var labelStyle = `style="${selectPanel.label.t || ''}"`;
			labelHtml = `<div class="typeLabel" ${labelStyle}>${labelText}</div>`;
		}
		return `<div class="exhibit ${selectPanel.name}" style="${selectPanel.t || ''}"><div class="typesetting">${rowList.join('')}</div>${labelHtml}</div>`;
	};
	// 绘制键值表
	const drawKeyTable = (selectKeys) => {
		var tabPanelRows = [];
		for (let i = 0, j = selectKeys.length; i < j; ++i) {
			let keyvals = selectKeys[i];
			let keyHtmlList = [];
			for (let k in keyvals) keyHtmlList.push(`<div class="keycap" code="${k}">${keyvals[k].replace(/\n/, '<br/>')}</div>`);
			tabPanelRows.push(`<div class="keyshelf">${keyHtmlList.join('')}</div>`);
		}
		return tabPanelRows.join('');
	};
	// 载入资源
	let appres = {
		dkey: 'AppResources',
		path: 'pages/App/',
		file: ['HID_KeyboardPage.json', 'HID_ConsumerPage.json', 'HID_Special.json', 'DEV_PartLayout.json', 'DEV_TabPanel.json'],
		blob: {},
	};
	let selectedKeycap = null;
	loadfiles(
		appres,
		async (blob, name) => {
			switch (name) {
				case 'DEV_PartLayout.json':
					// 绘制键盘布局
					let PartLayout = await new Response(blob).json();
					const devContent = document.createElement('div');
					devContent.className = 'content';
					devContent.insertAdjacentHTML('afterbegin', drawLayout(PartLayout[0]));
					window.pageElement.insertAdjacentElement('afterbegin', devContent);
					// 绑定界面缩放
					const devExhibit = devContent.firstChild;
					var resizeTimer = setTimeout(() => {
						transform(devExhibit);
					}, 200);
					window.addEventListener('resize', () => {
						clearTimeout(resizeTimer);
						resizeTimer = setTimeout(() => {
							transform(devExhibit);
						}, 200);
					});
					// 绑定键盘布局点击事件
					devContent.addEventListener('click', (e) => {
						if (selectedKeycap) selectedKeycap.classList.remove('blink');
						if (e.target.classList.contains('keycap')) {
							selectedKeycap = e.target;
							selectedKeycap.classList.add('blink');
						}
						console.log(`你点击了:`, e.target);
					});
					break;
				case 'DEV_TabPanel.json':
					let KeyCodes = await new Response(blob).json();
					// 构建选项卡元素
					const cfgsElement = document.createElement('div');
					cfgsElement.className = 'configs';
					window.pageElement.insertAdjacentElement('beforeend', cfgsElement);
					// 构建标签列表
					const tabList = document.createElement('div');
					tabList.className = 'tab_list';
					tabList.insertAdjacentHTML(
						'beforeend',
						Object.keys(KeyCodes)
							.map((k) => `<div class="tab_label">${k}</div>`)
							.join('')
					);
					cfgsElement.insertAdjacentElement('afterbegin', tabList);
					// 构建标签容器
					const tabContent = document.createElement('div');
					tabContent.className = 'tab_content';
					cfgsElement.insertAdjacentElement('beforeend', tabContent);
					// 构建对应标签的配置面板
					const tabPanel = document.createElement('div');
					tabPanel.className = 'tab_panel';
					tabContent.insertAdjacentElement('afterbegin', tabPanel);
					// 绑定标签列表点击事件
					var selectedTabLabel;
					tabList.addEventListener('click', (e) => {
						selectedTabLabel = e.target;
						if (!selectedTabLabel.classList.contains('tab_label')) return;
						tabList.childNodes.forEach((node) => node.removeAttribute('selected'));
						selectedTabLabel.setAttribute('selected', '');
						switch (selectedTabLabel.textContent) {
							case 'Ansi':
								tabPanel.innerHTML = drawKeyTable(KeyCodes.Ansi);
								break;
							case 'Basic':
								tabPanel.innerHTML = drawKeyTable(KeyCodes.Basic);
								break;
							case 'Media':
								tabPanel.innerHTML = drawKeyTable(KeyCodes.Media);
								break;
							case 'Special':
								tabPanel.innerHTML = drawKeyTable(KeyCodes.Special);
								break;
							case 'Layers':
								tabPanel.innerHTML = drawKeyTable(KeyCodes.Layers);
								break;
							default:
								tabPanel.innerHTML = ``;
								console.log(`你点击了: `, selectedTabLabel);
								break;
						}
					});
					tabList.firstChild.click();
					// 绑定键值表点击事件
					tabPanel.addEventListener('click', (e) => {
						let tapElement = e.target;
						if (tapElement.classList.contains('keycap')) {
							if (selectedKeycap != null) {
								selectedKeycap.innerHTML = tapElement.innerHTML;
								selectedKeycap.setAttribute('code', tapElement.getAttribute('code'));
								selectedKeycap.classList.remove('blink');
								let prevNode = selectedKeycap;
								let nextNode = prevNode.nextElementSibling;
								while (true) {
									if (nextNode != null) {
										if (nextNode.classList.contains('keycap')) {
											nextNode.click();
											break;
										} else {
											prevNode = nextNode;
											nextNode = prevNode.nextElementSibling;
											continue;
										}
									}
									nextNode = prevNode.parentNode.nextElementSibling;
									if (nextNode == null) {
										selectedKeycap = null;
										break;
									}
									nextNode = nextNode.firstElementChild;
								}
							}
						}
					});
					// 绑定鼠标悬停事件
					const tabTips = document.createElement('div');
					tabTips.className = 'tab_tips';
					tabContent.insertAdjacentElement('beforeend', tabTips);
					tabPanel.addEventListener('mouseover', (e) => {
						tabTips.innerHTML = '';
						let tapElement = e.target;
						if (tapElement.classList.contains('keycap')) {
							let nodeCode = tapElement.getAttribute('code');
							switch (selectedTabLabel.textContent) {
								case 'Ansi':
								case 'Basic':
									if (!appres.HID_KeyboardPage) break;
									tabTips.innerText = `KeyCode= ${nodeCode};    KeyValue= ${appres.HID_KeyboardPage[nodeCode]}`;
									break;
								case 'Media':
									if (!appres.HID_ConsumerPage) break;
									tabTips.innerText = `KeyCode= ${nodeCode};    KeyValue= ${appres.HID_ConsumerPage[nodeCode]}`;
									break;
								case 'Special':
									if (!appres.HID_Special) break;
									tabTips.innerText = `KeyCode= ${nodeCode};    KeyValue= ${appres.HID_Special[nodeCode]}`;
									break;
								case 'Layers':
									if (e.target.textContent.startsWith('Fn')) {
										tabTips.innerText = `${e.target.textContent}:  Hold to select layer ${e.target.textContent.slice(2)}`;
									}
									if (e.target.textContent.startsWith('DL')) {
										tabTips.innerText = `${e.target.textContent}:  Set the default layer ${e.target.textContent.slice(2)}`;
									}
									break;
								default:
									tabPanel.innerText = ``;
									console.log(`你点击了: `, selectedTabLabel);
									break;
							}
						}
					});
					break;
				case 'HID_KeyboardPage.json':
					appres.HID_KeyboardPage = await new Response(blob).json();
					break;
				case 'HID_ConsumerPage.json':
					appres.HID_ConsumerPage = await new Response(blob).json();
					break;
				case 'HID_Special.json':
					appres.HID_Special = await new Response(blob).json();
					break;
			}
		},
		0
	);

	return window.pageElement;
})();