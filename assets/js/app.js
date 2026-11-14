/*!
 * DIY装机导航 - 前端脚本（原生 JS，替代 jQuery 88KB + Bootstrap JS 64KB + svg.js 200KB）
 * 功能与原版一致：搜索源切换、搜索建议、时间显示、移动端菜单、返回顶部
 */
(function () {
	'use strict';

	/* ---------------- 天气挂件配置（需在 qweather 脚本执行前就绪） ---------------- */
	window.WIDGET = {
		CONFIG: {
			modules: '12043',
			background: '5',
			tmpColor: 'FFFFFF',
			tmpSize: '16',
			cityColor: 'FFFFFF',
			citySize: '18',
			aqiColor: 'FFFFFF',
			aqiSize: '16',
			weatherIconSize: '24',
			alertIconSize: '18',
			padding: '0px 0px 0px 0px',
			shadow: '0',
			language: 'auto',
			fixed: 'false',
			vertical: 'center',
			horizontal: 'center',
			right: '0',
			top: '0',
			key: '9d714f8dd6b94c7696f9cea8dc3ed1c5'
		}
	};

	var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
	var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

	/* ---------------- 时钟：只在数值变化时写 DOM，避免高频重排 ---------------- */
	var lastClock = '';
	var lastDate = '';
	function tick() {
		var d = new Date();
		var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
		var clock = pad(d.getHours()) + ':' + pad(d.getMinutes());
		var date = d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' +
			'日一二三四五六'.charAt(d.getDay());

		if (clock !== lastClock) {
			lastClock = clock;
			$$('[data-clock]').forEach(function (el) { el.textContent = clock; });
		}
		if (date !== lastDate) {
			lastDate = date;
			$$('[data-date]').forEach(function (el) { el.textContent = date; });
		}
	}
	tick();
	setInterval(tick, 1000);

	/* ---------------- 搜索：引擎切换 ---------------- */
	var form = $('#super-search-fm');
	var input = $('#search-text');
	var radios = $$('input[name="type"]');
	var groups = $$('.search-group');
	var newWinBox = $('#set-search-blank');
	var suggestBox = $('#word');

	function currentRadio() {
		var saved = localStorage.getItem('superSearchType');
		var target = null;
		if (saved) {
			for (var i = 0; i < radios.length; i++) {
				if (radios[i].value === saved) { target = radios[i]; break; }
			}
		}
		// 没有历史记录时默认第一个引擎（百度），与原版行为一致
		target = target || radios[0];
		if (target) target.checked = true;
		return target || radios[0];
	}

	function applyType(radio) {
		input.placeholder = radio.getAttribute('data-placeholder') || '';
		// 让 form 的 action 始终与当前引擎一致（提交已被 JS 接管，这里只是兜底）
		if (form) form.setAttribute('action', radio.value);
		groups.forEach(function (g) {
			g.classList.remove('s-current');
			if (g.contains(radio)) g.classList.add('s-current');
		});
		localStorage.setItem('superSearchType', radio.value);
	}

	function openInNewTab() {
		var v = localStorage.getItem('superSearchNewWin');
		return v ? v === '1' : true;
	}

	radios.forEach(function (r) {
		r.addEventListener('change', function () {
			applyType(r);
			if (input) input.focus();
		});
	});
	applyType(currentRadio());

	if (newWinBox) {
		newWinBox.checked = openInNewTab();
		newWinBox.addEventListener('change', function () {
			localStorage.setItem('superSearchNewWin', newWinBox.checked ? '1' : '0');
		});
	}

	if (form && input) {
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var kw = input.value.trim();
			if (!kw) { input.focus(); return; }
			var url = currentRadio().value + encodeURIComponent(kw);
			if (openInNewTab()) window.open(url, '_blank', 'noopener');
			else location.href = url;
		});
	}

	/* ---------------- 搜索建议：防抖 + JSONP，替代每次 keyup 都发请求 ---------------- */
	var sugTimer = null;
	var sugSeq = 0;

	function hideSuggest() {
		if (suggestBox) { suggestBox.textContent = ''; suggestBox.style.display = 'none'; }
	}

	function renderSuggest(list) {
		if (!suggestBox) return;
		if (!list || !list.length) { hideSuggest(); return; }
		var frag = document.createDocumentFragment();
		list.slice(0, 10).forEach(function (text) {
			var li = document.createElement('li');
			li.textContent = text;
			frag.appendChild(li);
		});
		suggestBox.textContent = '';
		suggestBox.appendChild(frag);
		suggestBox.style.display = 'block';
	}

	function fetchSuggest(kw) {
		var seq = ++sugSeq;
		var cbName = 'baiduSug_' + seq;
		var script = document.createElement('script');
		var done = false;

		function cleanup() {
			done = true;
			script.remove();
			try { delete window[cbName]; } catch (err) { window[cbName] = undefined; }
		}

		window[cbName] = function (data) {
			if (seq !== sugSeq) { cleanup(); return; }
			cleanup();
			renderSuggest(data && data.s);
		};

		script.onerror = function () { if (!done) { cleanup(); hideSuggest(); } };
		script.src = 'https://suggestion.baidu.com/su?wd=' + encodeURIComponent(kw) + '&cb=' + cbName;
		document.body.appendChild(script);
	}

	if (input && suggestBox) {
		input.addEventListener('input', function () {
			var kw = input.value.trim();
			clearTimeout(sugTimer);
			if (!kw) { hideSuggest(); return; }
			sugTimer = setTimeout(function () { fetchSuggest(kw); }, 220);
		});

		input.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') hideSuggest();
		});

		// 点击建议项 -> 回填并直接搜索
		suggestBox.addEventListener('click', function (e) {
			var li = e.target.closest('li');
			if (!li) return;
			input.value = li.textContent;
			hideSuggest();
			form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
		});

		document.addEventListener('click', function (e) {
			if (!suggestBox.contains(e.target) && e.target !== input) hideSuggest();
		});
	}

	/* ---------------- 移动端菜单：替代 Bootstrap JS ---------------- */
	var toggler = $('.navbar-toggler');
	var navCollapse = $('#navbarsExample05');
	if (toggler && navCollapse) {
		toggler.addEventListener('click', function () {
			var open = navCollapse.classList.toggle('show');
			toggler.classList.toggle('collapsed', !open);
			toggler.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
	}

	/* ---------------- 返回顶部：纯 CSS 控制显隐，滚动用 rAF 节流 ---------------- */
	var topBtn = document.createElement('a');
	topBtn.id = 'toTop';
	topBtn.href = 'javascript:void(0)';
	topBtn.title = '返回顶部';
	topBtn.setAttribute('aria-label', '返回顶部');
	topBtn.addEventListener('click', function () {
		window.scrollTo({ top: 0, behavior: 'smooth' });
	});
	document.body.appendChild(topBtn);

	var ticking = false;
	function onScroll() {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(function () {
			var y = window.pageYOffset || document.documentElement.scrollTop;
			topBtn.classList.toggle('is-visible', y > 200);
			ticking = false;
		});
	}
	window.addEventListener('scroll', onScroll, { passive: true });
	onScroll();

	/* ---------------- 第三方图标加载失败兜底（避免一排破图） ---------------- */
	var FALLBACK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><rect width="45" height="45" rx="8" fill="#eef1f5"/>' +
		'<path d="M22.5 27.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-13a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" fill="#c9d1db"/>' +
		'<path d="M12 19h4l3-3h7l3 3h4v12H12V19z" fill="none" stroke="#c9d1db" stroke-width="2"/></svg>');

	window.addEventListener('error', function (e) {
		var el = e.target;
		if (el && el.tagName === 'IMG' && !el.dataset.fallback) {
			el.dataset.fallback = '1';
			el.src = FALLBACK;
		}
	}, true);

	/* ---------------- 首屏自动聚焦搜索框 ---------------- */
	window.addEventListener('load', function () {
		// 移动端不自动聚焦，避免弹出键盘遮挡首屏
		if (input && window.innerWidth > 992) input.focus({ preventScroll: true });
	});
})();
