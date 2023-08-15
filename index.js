"use strict";
(async () => {
    let sleep = (millisecond) => new Promise((resolve) => setTimeout(resolve, millisecond));
    let getType = (T) => Object.prototype.toString.call(T).slice(8, -1);
    let mimetypes = {
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
    let fetchAll = async (infolist, timeout) => {
        let fetchInfos = infolist.map((info) => (getType(info) === 'Object' ? info : { url: info, options: {} }));
        let controller = new AbortController();
        let timeoutTimer;
        if (timeout) {
            fetchInfos.forEach((info) => {
                info.options || (info.options = {});
                info.options.signal = controller.signal;
            });
            timeoutTimer = setTimeout(() => controller.abort(), timeout);
        }
        let resArray = [];
        try {
            resArray = await Promise.all(fetchInfos.map((info) => fetch(info.url, info.options)));
            clearTimeout(timeoutTimer);
        }
        catch (error) {
            if (controller.signal.aborted) {
                console.log('fetch timeout:', fetchInfos);
            }
        }
        return resArray;
    };
    // 加载基础功能库 [localforage, jszip]
    let localforageJS = localStorage.getItem('localforageJS') || (await fetch('resources/js/localforage.min.js').then((res) => res.text()));
    let JSZipJS = localStorage.getItem('JSZipJS') || (await fetch('resources/js/jszip.min.js').then((res) => res.text()));
    eval(localforageJS);
    eval(JSZipJS);
    localStorage.setItem('localforageJS', localforageJS);
    localStorage.setItem('JSZipJS', JSZipJS);
    /**
     * 加载资源文件（并缓存到indexedDB）
     *
     * @param res [resInfo] 待加载的资源信息
     * @param callback 回调函数(每加载一个文件调用一次)
     * @param nextUpdateTime 下次更新时间(单位:秒, 默认值 -1 为不更新)
     * @param reloadCallback 下次更新后是否重新运行回调函数(默认值 false)
     */
    let loadfiles = async (res, callback, nextUpdateTime = -1, reloadCallback = false) => {
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
                    }
                    catch (error) {
                        console.log(`Resouce load failed (${fileName}):`, error);
                        return;
                    }
                })();
            }
            else {
                needUpdate = true;
                callback?.(res.blob[fileName], fileName);
            }
        });
        needUpdate &&
            nextUpdateTime > 0 &&
            (async () => {
                await sleep(nextUpdateTime * 1000);
                console.log(`[UpdateFilesTask] update resource:`, { dkey: res.dkey });
                loadfiles(res, reloadCallback && callback, 0, false);
            })();
    };
    // 库文件加载函数
    const srcRegExp = /[^/]+\/*[^/]+$/; // 匹配url中的文件名
    const urlRegExp = /url\(["']*([^?#'"\)]+)([^'"\)]*)['"]*/g; // 匹配css中的url
    /**
     * 加载库文件（支持独立css/js或css资源压缩包。如: css字体库、css图标库）
     * @param res [resInfo] 库文件zip包资源信息
     */
    let loadLibrarys = (res, callback) => {
        loadfiles(res, async (blob, name) => {
            if (blob.type === mimetypes.js)
                return eval(await new Response(blob).text());
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
                        let newBlob = new Blob([cssText], { type: 'text/css' });
                        let cssHTML = `<link file="${name}" rel="stylesheet" href="${URL.createObjectURL(newBlob)}" />`;
                        document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
                        callback?.(name);
                    });
                });
                return;
            }
        });
    };
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
            Driver: 'fa-download',
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
                    if (tapElement.hasAttribute('selected'))
                        return;
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
    let urlHash = window.location.hash || '#Home';
    document.querySelector(urlHash)?.setAttribute('selected', '');
    if (!document.querySelector(`.navtab>[selected]`))
        document.querySelector(`.navtab>a[href="#Home"]`)?.click();
    // 绘制目的地列表
    let dests = {
        dkey: 'DestList',
        path: 'resources/json/',
        file: ['destlist.json'],
        blob: {},
    };
    let selectedDestId = await localforage.getItem('navdest');
    loadfiles(dests, async (blob, name) => {
        navbar.dests = JSON.parse(await new Response(blob).text());
        let destsHTML = navbar.dests.SP.map((destId) => (destId && `<div id="${destId}" class="fi-${destId.toLowerCase()} dest" title="${navbar.dests.en[destId] || ''}">${destId}</div>`) || `<div></div>`);
        document.getElementById('destbar').insertAdjacentHTML('beforeend', `<div class="dests">${destsHTML.join('')}</div>`);
    }, 0);
    // 目的地按钮点击事件
    document.getElementById('navdest').addEventListener('click', (e) => {
        let classList = document.getElementById('destbar').classList;
        classList.contains('hidden') ? classList.remove('hidden') : classList.add('hidden');
    });
    // 目的地列表点击事件
    document.getElementById('destbar').addEventListener('click', (e) => {
        let selectedDest = e.target;
        if (!selectedDest.classList.contains('dest'))
            return;
        document.getElementById('navdest').className = selectedDest.className;
        document.getElementById('destbar')?.classList.add('hidden');
        selectedDestId = selectedDest.id;
        localforage.setItem('navdest', selectedDestId);
    });
    // 指定范围外点击关闭下拉框
    window.addEventListener('mouseup', (e) => {
        document.querySelector('.navtab').contains(e.target) || document.querySelector('.head').classList.add('fold');
        if (document.getElementById('navdest').contains(e.target))
            return;
        if (document.querySelector('.dests').contains(e.target))
            return;
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
            while (!destbar.hasChildNodes())
                await sleep(100);
            destbar.classList.add('magictime', 'sliderightReturn');
            let navdest = document.getElementById('navdest');
            navdest.onanimationend = () => navdest.classList.remove('magictime', 'vanishIn');
            navdest.className = document.getElementById(selectedDestId).className;
            navdest.classList.add('magictime', 'vanishIn');
        }
    });
    let pages = {
        dkey: 'PageList',
        path: 'pages/',
        file: ['home.html', 'products.html', 'prettify.html', 'driver.html', 'support.html'],
    };
})();
