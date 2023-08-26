var g_eval = eval;
/**
 *  异步延时函数
 * @param millisecond 延时时间(单位:毫秒)
 */
window.sleep = (millisecond) => new Promise((resolve) => setTimeout(resolve, millisecond));
/**
 * 获取对象类型
 * @param T 待获取类型的对象
 */
window.getType = (T) => Object.prototype.toString.call(T).slice(8, -1);
/**
 * blob文件类型表
 */
window.mimetypes = {
	html: 'text/html',
	css: 'text/css',
	js: 'text/javascript',
	json: 'application/json',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	txt: 'text/plain',
	mp4: 'video/mp4',
	ttf: 'font/ttf',
	eot: 'font/eot',
	woff: 'font/woff',
	woff2: 'font/woff2',
	zip: 'application/zip',
};

/**
 * 带超时的并发fetch函数
 *
 * @param infolist [url] || [{url:string, options:{}}] 待请求的信息列表
 * @param timeout 超时时间(单位:毫秒)
 */
window.fetchAll = async (infolist, timeout) => {
	let fetchInfos = infolist.map((info) => (getType(info) === 'Object' ? info : {url: info, options: {}}));
	let controller = new AbortController();
	let timeoutTimer;
	if (timeout) {
		fetchInfos.forEach((info) => {
			info.options ||= {};
			info.options.signal = controller.signal;
		});
		timeoutTimer = setTimeout(() => controller.abort(), timeout);
	}
	let resArray = [];
	try {
		resArray = await Promise.all(fetchInfos.map((info) => fetch(info.url, info.options)));
		clearTimeout(timeoutTimer);
	} catch (error) {
		if (controller.signal.aborted) {
			console.log('fetch timeout:', fetchInfos);
		}
	}
	return resArray;
};

(async () => {
	// 加载基础功能库 [localforage, jszip]
	window.localforage = undefined;
	window.JSZip = undefined;
	let baseUrl = (location.href.endsWith('.html') ? '/' : '') + 'resources/js/';
	let localforageJS = localStorage.getItem('localforageJS') || (await fetch(`${baseUrl}localforage.min.js`).then((res) => res.text()));
	let JSZipJS = localStorage.getItem('JSZipJS') || (await fetch(`${baseUrl}jszip.min.js`).then((res) => res.text()));
	g_eval(localforageJS);
	g_eval(JSZipJS);
	localStorage.setItem('localforageJS', localforageJS);
	localStorage.setItem('JSZipJS', JSZipJS);
	while (!window.localforage && !window.JSZip) await sleep(100);

	/**
	 * 资源信息接口
	 *
	 * @param dkey 资源标识
	 * @param path 资源路径
	 * @param file 资源文件名列表
	 * @param blob 资源文件数据
	 */
	class resInfo {
		dkey; // string;
		path; // string;
		file; // string[];
		blob; // any;
	}

	/**
	 * 加载资源文件（并缓存到indexedDB）
	 *
	 * @param res [resInfo] 待加载的资源信息
	 * @param callback 回调函数(每加载一个文件调用一次)
	 * @param nextUpdateTime 下次更新时间(单位:秒, 默认值 -1 为不更新)
	 * @param reloadCallback 下次更新后是否重新运行回调函数(默认值 false)
	 */
	window.loadfiles = async (res, callback = undefined, nextUpdateTime = -1, reloadCallback = false) => {
		let needUpdate = false;
		let localBlob = (await localforage.getItem(res.dkey)) || {};
		res.file.forEach((fileName) => (res.blob[fileName] = localBlob[fileName])); // 创建数据转储，以便过滤过时资源
		res.file.forEach((fileName) => {
			if (!res.blob[fileName]?.size || nextUpdateTime === 0) {
				(async () => {
					try {
						let response = await fetch(res.path + fileName);
						if (!response.ok) {
							throw new Error(`${response.status} ${response.statusText}`);
						}
						let blob = await response.blob();
						res.blob[fileName] = blob;
						await localforage.setItem(res.dkey, res.blob);
						callback?.(res.blob[fileName], fileName);
					} catch (error) {
						console.log(`Resouce load failed (${fileName}):`, error);
						return;
					}
				})();
			} else {
				needUpdate = true;
				callback?.(res.blob[fileName], fileName);
			}
		});
		needUpdate &&
			nextUpdateTime > 0 &&
			(async () => {
				await sleep(nextUpdateTime * 1000);
				console.log(`[UpdateFilesTask] update resource:`, {dkey: res.dkey});
				loadfiles(res, reloadCallback && callback, 0, false);
			})();
	};

	// 库文件加载函数
	const srcRegExp = /[^/]+\/*[^/]+$/; // 匹配url中的文件名
	const urlRegExp = /url\(["']*([^?#'"\)]+)([^'"\)]*)['"]*/g; // 匹配css中的url
	/**
	 * 加载库文件（支持独立css/js或css资源压缩包。如: css字体库、css图标库）
	 * @param res [resInfo] 库文件zip包资源信息
	 * @param callback 回调函数(每加载一个文件调用一次)
	 */
	window.loadLibrarys = (res, callback) => {
		loadfiles(res, async (blob, name) => {
			if (blob.type === mimetypes.js) return g_eval(await new Response(blob).text());
			if (blob.type === mimetypes.css) {
				let cssHTML = `<link file="${name}" rel="stylesheet" href="${URL.createObjectURL(blob)}" />`;
				document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
				return;
			}
			if (blob.type === mimetypes.zip) {
				JSZip.loadAsync(blob).then(async (zip) => {
					let cssBlobs = [];
					let resBlobs = {};
					// 遍历并获取zip内的文件(key=path,val=file)
					for (let file of Object.values(zip.files)) {
						let fileName = file.name.match(srcRegExp)?.[0];
						if (!fileName) {
							continue;
						}
						let fileType = mimetypes[fileName.split('.').pop()];
						if (!fileType) {
							console.warn(`[LoadLibraryTask] unknow file type：${fileName}`);
							continue;
						}
						let fileBlob = await file.async('blob');
						if (fileName.endsWith('.css')) {
							cssBlobs.push(fileBlob.slice(0, fileBlob.size, fileType));
							continue;
						}
						resBlobs[fileName] = URL.createObjectURL(fileBlob.slice(0, fileBlob.size, fileType));
					}
					// 替换css内引用资源路径
					cssBlobs.forEach(async (cssBlob) => {
						let cssText = await new Response(cssBlob).text();
						cssText = cssText.replace(urlRegExp, (match, p1, p2) => {
							let srcBlob = resBlobs[p1.match(srcRegExp)?.[0]];
							return (srcBlob && `url("${srcBlob}${p2}"`) || match;
						});
						let newBlob = new Blob([cssText], {type: 'text/css'});
						let cssHTML = `<link file="${name}" rel="stylesheet" href="${URL.createObjectURL(newBlob)}" />`;
						document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
						callback?.(name);
					});
				});
				return;
			}
		});
	};

	console.log('JS_Tools loaded!');
	return (window.JS_Tools_Loaded = true);
})();
