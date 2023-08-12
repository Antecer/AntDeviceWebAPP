"use strict";
(async () => {
    let sleep = (millisecond) => new Promise((resolve) => setTimeout(resolve, millisecond));
    let getType = (T) => Object.prototype.toString.call(T).slice(8, -1);
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
    };
    let fetchAll = async (infolist, timeout) => {
        let fetchInfos = infolist.map(info => getType(info) === 'Object' ? info : { url: info, options: {} });
        let controller = new AbortController();
        let timeoutTimer;
        if (timeout) {
            fetchInfos.forEach(info => { info.options || (info.options = {}); info.options.signal = controller.signal; });
            timeoutTimer = setTimeout(() => controller.abort(), timeout);
        }
        let resArray = [];
        try {
            resArray = await Promise.all(fetchInfos.map(info => fetch(info.url, info.options)));
            clearTimeout(timeoutTimer);
        }
        catch (error) {
            if (controller.signal.aborted) {
                console.log('fetch timeout:', fetchInfos);
            }
            ;
        }
        return resArray;
    };
    // 加载localforage库
    let localforagejs = localStorage.getItem('localforage');
    if (!localforagejs) {
        localforagejs = await fetch('/resources/js/localforage.min.js').then(res => res.text());
        window.localStorage.setItem('localforage', localforagejs);
    }
    eval(localforagejs);
    // 资源加载函数
    let loadfiles = async (res, callback) => {
        let localBlob = (await localforage.getItem(res.dkey)) || {};
        res.file.forEach(name => res.blob[name] = localBlob[name]);
        res.file.forEach(async (name) => {
            if (!res.blob[name]?.size) {
                try {
                    let response = await fetch(res.path + name);
                    if (!response.ok)
                        throw new Error(`${response.status} ${response.statusText}`);
                    let blob = await response.blob();
                    res.blob[name] = blob;
                    await localforage.setItem(res.dkey, res.blob);
                }
                catch (error) {
                    console.log(`Resouce load failed (${name}):`, error);
                    return;
                }
            }
            callback(res.blob[name], name);
        });
    };
    // 加载css库
    let styles = {
        dkey: 'StyleList',
        path: '/resources/css/',
        file: ['animate.min.css'],
        blob: {}
    };
    loadfiles(styles, (blob, name) => {
        let cssHTML = `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(blob)}" />`;
        document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
    });
    // 加载js库
    let scripts = {
        dkey: 'ScriptList',
        path: '/resources/js/',
        file: ['jszip.min.js'],
        blob: {}
    };
    let JSZipReady;
    loadfiles(scripts, (blob, name) => {
        blob.text().then(jstext => JSZipReady = eval(jstext));
    });
    // 加载背景图片
    let banners = {
        dkey: 'BannerList',
        path: '/resources/images/',
        file: ['bgimg0.jpg', 'bgimg1.jpg'],
        blob: {}
    };
    loadfiles(banners, (blob, name) => {
        if (name == banners.file[0]) {
            document.getElementById('backdrop')?.setAttribute('src', URL.createObjectURL(blob));
            var meta = document.querySelector('meta[name="theme-color"]'); // 设置主题色
            meta.setAttribute('content', '#0001');
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
        DestList: {},
        DestFlag: {}
    };
    let logoHTML = `<div class="navlogo">${navbar.logo}</div>`;
    let tabsHTML = Object.entries(navbar.tabs).map(([tab, icon]) => {
        if (tab != 'ShipTo') {
            return `<a class="${icon}" href="#${tab}">${tab}</a>`;
        }
        return `<a id="${tab}" class="${icon}" href="javascript:;">${tab}</a>`;
    }).join('');
    document.getElementById('navbar')?.insertAdjacentHTML('beforeend', `${logoHTML}<div class="navtab">${tabsHTML}</div>`);
    let navtabEvent = (e) => {
        let tapElement = e.target;
        if (tapElement.localName != 'a')
            return;
        if (tapElement.id != 'ShipTo') {
            switch (e.type) {
                case 'mouseover':
                    tapElement.classList.add('animate__animated', 'animate__pulse');
                    break;
                case 'mouseout':
                    tapElement.classList.remove('animate__animated', 'animate__pulse');
                    break;
                case 'click':
                    document.querySelector('.navtab>[selected]')?.removeAttribute('selected');
                    tapElement.setAttribute('selected', '');
                    break;
            }
            return;
        }
        else {
            if (e.type == 'click') {
                let destbarElement = document.getElementById('destbar');
                destbarElement.style.display = destbarElement.style.display == 'none' ? 'flex' : 'none';
            }
        }
    };
    let navtabElement = document.querySelector('.navtab');
    navtabElement?.addEventListener('click', navtabEvent);
    navtabElement?.addEventListener('mouseover', navtabEvent);
    navtabElement?.addEventListener('mouseout', navtabEvent);
    let urlHash = window.location.hash || '#Home';
    document.querySelector(`.navtab>a[href="${urlHash}"]`)?.setAttribute('selected', '');
    if (!document.querySelector(`.navtab>[selected]`))
        document.querySelector(`.navtab>a[href="#Home"]`)?.click();
    // 绘制目的地列表
    let dests = {
        dkey: 'DestList',
        path: '/resources/json/',
        file: ['destlist.json'],
        blob: {}
    };
    let loadShipTo = await localforage.getItem('ShipTo');
    loadfiles(dests, async (blob, name) => {
        navbar.DestList = JSON.parse(await blob.text());
        let destsHTML = navbar.DestList.SP.map((name) => `<div id="${name}" class="flag-icon flag-icon-${name.toLowerCase()}">${navbar.DestList.en[name]}</div>`);
        document.getElementById('destbar')?.insertAdjacentHTML('beforeend', `<div></div><div class="dests">${destsHTML.join('')}</div>`);
        if (loadShipTo) {
            document.getElementById('ShipTo').innerHTML = document.getElementById(loadShipTo).innerHTML;
            document.getElementById('ShipTo').className = document.getElementById(loadShipTo).className;
        }
    });
    document.getElementById('destbar')?.addEventListener('click', (e) => {
        let selectedDest = e.target;
        if (selectedDest.id == '')
            return;
        document.getElementById('ShipTo').innerHTML = selectedDest.innerHTML;
        document.getElementById('ShipTo').className = selectedDest.className;
        document.getElementById('destbar').style.display = 'none';
        loadShipTo = selectedDest.id;
        localforage.setItem('ShipTo', loadShipTo);
    });
    document.querySelector('.header')?.addEventListener('mouseleave', (e) => {
        document.getElementById('destbar').style.display = 'none';
    });
    // 加载CSS图标库
    let cssIcons = {
        dkey: 'IconList',
        path: '/resources/icons/',
        file: ['flags.zip', 'fontawesome5less.zip'],
        blob: {}
    };
    loadfiles(cssIcons, async (blob, name) => {
        while (!JSZipReady)
            await sleep(100);
        JSZip.loadAsync(blob).then(async (zip) => {
            let cssBlobs = [];
            let resBlobs = {};
            // 遍历zip内的文件(key=path,val=file)
            for (let file of Object.values(zip.files)) {
                let fileName = file.name.split('/').pop();
                if (!fileName)
                    continue;
                let fileType = mimetypes[fileName.split('.').pop()];
                if (!fileType) {
                    console.log(`unknow file type：${fileName}`);
                    continue;
                }
                let fileBlob = await file.async("blob");
                if (fileName.endsWith('.css')) {
                    cssBlobs.push(fileBlob.slice(0, fileBlob.size, fileType));
                    continue;
                }
                resBlobs[fileName] = fileBlob.slice(0, fileBlob.size, fileType);
            }
            // 修改css内引用文件路径
            cssBlobs.forEach(async (cssBlob) => {
                let cssText = (await cssBlob.text()).replace(/url\([^\?#)]+/g, (match) => {
                    if (resBlobs[match.split('/').pop()]) {
                        return `url(` + URL.createObjectURL(resBlobs[match.split('/').pop()]);
                    }
                });
                let newBlob = new Blob([cssText], { type: 'text/css' });
                let cssHTML = `<link id="${name.replace(/\./g, '_')}" rel="stylesheet" href="${URL.createObjectURL(newBlob)}" />`;
                document.querySelector('link[rel="stylesheet"]')?.insertAdjacentHTML('beforebegin', cssHTML);
            });
        });
    });
})();
