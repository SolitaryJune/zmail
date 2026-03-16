// ==UserScript==
// @name         OpenAI 自动注册助手 (Zmail)
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  OpenAI 全流程自动注册：邮箱/密码/验证码/个人信息/授权/错误重试 全自动
// @author       You
// @match        https://auth.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      * 
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const ZMAIL_BASE_URL = '';
    const ZMAIL_AUTH_PASSWORD = '';

    const FIRST_NAMES = ['James', 'Mary', 'Robert', 'John', 'Michael', 'David', 'William', 'Emma',
        'Olivia', 'Noah', 'Liam', 'Sophia', 'Ava', 'Isabella', 'Mia', 'Charlotte'];
    const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
        'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson'];

    const log = msg => console.log(`[OAI-Auto] ${msg}`);
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function randomName() {
        return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
            + ' '
            + LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    }
    function randomAge() { return Math.floor(Math.random() * 3) + 20; }
    function randomBirthday2004() {
        const year = 2004, month = Math.floor(Math.random() * 12) + 1;
        const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
        const day = Math.floor(Math.random() * maxDay) + 1;
        return { year, month, day, iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
    }

    function zmailHeaders() {
        const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
        if (ZMAIL_AUTH_PASSWORD) h['Authorization'] = `Bearer ${ZMAIL_AUTH_PASSWORD}`;
        return h;
    }
    function gmFetch(method, url, headers, body) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method, url, headers,
                data: body ? JSON.stringify(body) : undefined,
                timeout: 15000,
                onload: res => { try { resolve({ status: res.status, data: JSON.parse(res.responseText) }); } catch { resolve({ status: res.status, data: {} }); } },
                onerror: () => reject(new Error(`请求失败: ${url}`)),
                ontimeout: () => reject(new Error(`请求超时: ${url}`)),
            });
        });
    }
    function randomPrefix() {
        const w = ['swift', 'brave', 'calm', 'star', 'moon', 'fast', 'gold', 'jade', 'ruby', 'byte', 'node', 'edge'];
        return w[Math.floor(Math.random() * w.length)] + w[Math.floor(Math.random() * w.length)] + (Math.floor(Math.random() * 90) + 10);
    }
    function generatePassword() {
        const w = ['June', 'July', 'Star', 'Moon', 'Wave', 'Fire', 'Gold', 'Blue', 'Jade', 'Rose', 'Iron', 'Edge', 'Bolt', 'Cyan', 'Nova', 'Apex', 'Dusk', 'Dawn', 'Flux', 'Hawk'];
        return w[Math.floor(Math.random() * w.length)] + w[Math.floor(Math.random() * w.length)] + (Math.floor(Math.random() * 9000) + 1000);
    }
    function setNativeValue(el, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function waitFor(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const t0 = Date.now();
            const tick = () => { const el = document.querySelector(selector); if (el) return resolve(el); if (Date.now() - t0 > timeout) return reject(new Error(`超时:${selector}`)); setTimeout(tick, 200); };
            tick();
        });
    }

    // ── UI ──────────────────────────────────────────
    let btnEl = null, toastEl = null;

    function ensureToast() {
        if (toastEl && document.body.contains(toastEl)) return toastEl;
        toastEl = document.createElement('div');
        Object.assign(toastEl.style, {
            position: 'fixed', bottom: '72px', right: '20px', zIndex: '2147483647',
            padding: '8px 14px', background: 'rgba(0,0,0,0.82)', color: '#fff',
            borderRadius: '8px', fontSize: '13px', maxWidth: '300px', lineHeight: '1.7',
            display: 'none', whiteSpace: 'pre-wrap', pointerEvents: 'none', fontFamily: 'system-ui,sans-serif',
        });
        document.body.appendChild(toastEl);
        return toastEl;
    }
    function toast(msg) { const el = ensureToast(); el.style.display = msg ? 'block' : 'none'; el.textContent = msg || ''; }
    function makeBtn(label, onClick) {
        if (btnEl && document.body.contains(btnEl)) { btnEl.remove(); btnEl = null; }
        btnEl = document.createElement('button');
        Object.assign(btnEl.style, {
            position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
            padding: '12px 22px', background: '#10a37f', color: '#fff',
            border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700',
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            transition: 'background .2s,transform .1s', fontFamily: 'system-ui,sans-serif',
        });
        btnEl.textContent = label;
        btnEl.addEventListener('mouseenter', () => { if (!btnEl.disabled) btnEl.style.background = '#0d8f6f'; });
        btnEl.addEventListener('mouseleave', () => { btnEl.style.background = '#10a37f'; });
        btnEl.addEventListener('mousedown', () => { btnEl.style.transform = 'scale(.97)'; });
        btnEl.addEventListener('mouseup', () => { btnEl.style.transform = 'scale(1)'; });
        btnEl.addEventListener('click', onClick);
        document.body.appendChild(btnEl);
        ensureToast();
        return btnEl;
    }
    function setBtn(label, disabled = false) {
        if (!btnEl) return;
        btnEl.textContent = label; btnEl.disabled = disabled;
        btnEl.style.opacity = disabled ? '0.6' : '1';
        btnEl.style.cursor = disabled ? 'not-allowed' : 'pointer';
    }
    function cleanUI() {
        if (btnEl && document.body.contains(btnEl)) { btnEl.remove(); btnEl = null; }
        if (toastEl && document.body.contains(toastEl)) { toastEl.remove(); toastEl = null; }
    }

    // ── Zmail ───────────────────────────────────────
    async function zmailCreate() {
        let res = await gmFetch('POST', `${ZMAIL_BASE_URL}/api/mailboxes`, zmailHeaders(), { address: randomPrefix() });
        if (![200, 201].includes(res.status))
            res = await gmFetch('POST', `${ZMAIL_BASE_URL}/api/mailboxes`, zmailHeaders(), {});
        if (![200, 201].includes(res.status) || !res.data?.success) throw new Error(`Zmail创建失败(${res.status})`);
        const address = res.data.mailbox.address;
        let domain = 'jo24.mail.gushao.club';
        try {
            const c = await gmFetch('GET', `${ZMAIL_BASE_URL}/api/config`, zmailHeaders());
            if (c.status === 200 && c.data?.config?.emailDomains?.length) domain = c.data.config.emailDomains[0];
        } catch { }
        return { email: `${address}@${domain}`, address };
    }

    async function zmailPollCode(address) {
        const regex = /(?<!\d)(\d{6})(?!\d)/;
        for (let i = 0; i < 40; i++) {
            setBtn(`📬 轮询验证码 (${i + 1}/40)`, true);
            toast(`⏳ 等待验证码...\n已尝试 ${i + 1} 次`);
            await sleep(3000);
            try {
                const lr = await gmFetch('GET', `${ZMAIL_BASE_URL}/api/mailboxes/${address}/emails`, zmailHeaders());
                if (lr.status !== 200) continue;
                for (const mail of (lr.data?.emails || [])) {
                    const sender = (mail.fromAddress || '').toLowerCase(), subject = mail.subject || '';
                    if (!sender.includes('openai') && !subject.toLowerCase().includes('openai')) continue;
                    const dr = await gmFetch('GET', `${ZMAIL_BASE_URL}/api/emails/${mail.id}`, zmailHeaders());
                    if (dr.status !== 200) continue;
                    const em = dr.data?.email || {};
                    const m = `${subject}\n${em.textContent || ''}\n${em.htmlContent || ''}`.match(regex);
                    if (m) return m[1];
                }
            } catch (e) { log(`轮询异常:${e.message}`); }
        }
        return null;
    }

    async function zmailSaveAccount() {
        if (!ZMAIL_AUTH_PASSWORD) { log('未配置密码，跳过保存'); return false; }
        const email = GM_getValue('zmail_email', '') || GM_getValue('zmail_email2', '');
        const password = GM_getValue('zmail_password', '');
        if (!email || !password) { log('邮箱或密码为空'); return false; }
        const now = new Date().toLocaleString('zh-CN');
        try {
            const res = await gmFetch('POST', `${ZMAIL_BASE_URL}/api/accounts`, zmailHeaders(), {
                title: `ChatGPT：${email}`,
                email: email,
                password: password,
                platforms: ['ChatGPT'],   // ★ 数组格式
                notes: `用户名${email}\n邮箱${email}\n密码${password}\n平台\nChatGPT\n注册时间：${now}`,
            });
            const ok = [200, 201].includes(res.status) && res.data?.success;
            log(ok ? `账号已保存:${email}` : `保存失败:${res.status}`);
            return ok;
        } catch (e) { log(`保存出错:${e.message}`); return false; }
    }

    // ── 错误页 ──────────────────────────────────────
    function isErrorPage() {
        const h1 = document.querySelector('h1');
        if (h1 && (h1.textContent.includes('出错') || h1.textContent.includes('糟糕') || h1.textContent.includes('Error'))) return true;
        if (document.querySelector('button[data-dd-action-name="Try again"]')) return true;
        const sub = document.querySelector('[class*="_subtitle_"],[class*="_subTitle_"]');
        if (sub && /timed out|error|failed|timeout/i.test(sub.textContent)) return true;
        return false;
    }

    async function handleErrorPage() {
        log('错误页，自动重试');
        const lastPath = GM_getValue('oai_last_path', '');
        toast(`⚠️ 检测到错误页\n${lastPath ? `上一步：${lastPath}` : ''}\n3秒后自动重试...`);
        makeBtn('🔄 自动重试中...', () => { });
        setBtn('🔄 自动重试中...', true);
        await sleep(3000);
        const retryBtn = document.querySelector('button[data-dd-action-name="Try again"],button[data-dd-action-name="重试"]');
        if (retryBtn && !retryBtn.disabled) { retryBtn.click(); await sleep(2000); dispatch(); return; }
        location.href = (lastPath && lastPath !== location.pathname) ? lastPath : '/create-account';
    }

    // ── 页面处理器 ───────────────────────────────────

    async function handleLoginPage() {
        log('登录页');
        GM_setValue('oai_last_path', '/log-in');
        try { await waitFor('a[href="/create-account"]'); } catch { }
        makeBtn('🚀 自动注册', async () => {
            setBtn('跳转中...', true); toast('跳转到注册页...');
            await sleep(300);
            const link = document.querySelector('a[href="/create-account"]');
            link ? link.click() : (location.href = '/create-account');
        });
    }

    async function handleCreateAccountPage() {
        log('注册页（邮箱）');
        GM_setValue('oai_last_path', '/create-account');
        try { await waitFor('input[name="email"]:not([readonly])'); } catch { }
        makeBtn('📧 获取临时邮箱', async () => {
            setBtn('创建邮箱中...', true); toast('正在创建 Zmail 临时邮箱...');
            try {
                const { email, address } = await zmailCreate();
                GM_setValue('zmail_address', address); GM_setValue('zmail_email', email);
                GM_setValue('zmail_address2', address); GM_setValue('zmail_email2', email);
                const input = document.querySelector('input[name="email"]:not([readonly])');
                if (!input) throw new Error('找不到可写邮箱输入框');
                input.focus(); setNativeValue(input, email);
                toast(`✅ 邮箱已填入:\n${email}\n等待提交...`);
                setBtn('✅ 邮箱已填入', true);
                await sleep(1200);
                const btn = document.querySelector('button[type="submit"][value="email"],button[data-dd-action-name="Continue"]');
                btn && !btn.disabled ? btn.click() : (toast(`✅ 邮箱已填入:\n${email}\n请手动点击"继续"`), setBtn('请手动点击继续', false));
            } catch (e) { toast(`❌ ${e.message}`); setBtn('📧 重新获取邮箱', false); }
        });
        await sleep(1500);
        if (btnEl && !btnEl.disabled) btnEl.click();
    }

    async function handlePasswordPage() {
        log('密码页');
        GM_setValue('oai_last_path', '/create-account/password');
        try { await waitFor('input[name="new-password"]'); } catch { }
        const getEmail = () => {
            const h = document.querySelector('input[name="username"]'); if (h?.value?.trim()) return h.value.trim();
            const r = document.querySelector('input[readonly][type="text"]'); if (r?.value?.trim()) return r.value.trim();
            return GM_getValue('zmail_email2', '') || GM_getValue('zmail_email', '');
        };
        const getAddress = () => {
            const a = GM_getValue('zmail_address2', '') || GM_getValue('zmail_address', ''); if (a) return a;
            const e = getEmail(); return e ? e.split('@')[0] : '';
        };
        const email = getEmail(), address = getAddress(), password = generatePassword();
        if (address) { GM_setValue('zmail_address', address); GM_setValue('zmail_address2', address); }
        if (email) { GM_setValue('zmail_email', email); GM_setValue('zmail_email2', email); }
        GM_setValue('zmail_password', password);
        makeBtn('🔑 自动填写密码', async () => {
            setBtn('填写中...', true); toast(`密码: ${password}\n正在填入...`);
            try {
                const pwdInput = document.querySelector('input[name="new-password"]');
                if (!pwdInput) throw new Error('找不到密码输入框');
                pwdInput.focus(); setNativeValue(pwdInput, password);
                toast(`✅ 密码已填入\n邮箱: ${email}\n密码: ${password}\n等待提交...`);
                setBtn('✅ 密码已填入', true); await sleep(1000);
                const btn = document.querySelector('button[data-dd-action-name="Continue"],button[type="submit"]');
                btn && !btn.disabled ? btn.click() : (toast(`✅ 密码已填入\n请手动点击"继续"`), setBtn('请手动点击继续', false));
            } catch (e) { toast(`❌ ${e.message}`); setBtn('🔑 重试', false); }
        });
        await sleep(800);
        if (btnEl && !btnEl.disabled) btnEl.click();
    }

    async function handleVerificationPage() {
        log('验证码页');
        GM_setValue('oai_last_path', '/email-verification');
        try { await waitFor('[class*="_subTitle_"],input[name="code"]', 8000); } catch { }
        await sleep(500);
        let address = GM_getValue('zmail_address', '') || GM_getValue('zmail_address2', '');
        let email = GM_getValue('zmail_email', '') || GM_getValue('zmail_email2', '');
        if (!address) {
            const sub = document.querySelector('[class*="_subTitle_"]');
            if (sub) {
                const m = sub.textContent.match(/[\w.+-]+@[\w.-]+\.\w+/);
                if (m) {
                    email = m[0]; address = m[0].split('@')[0];
                    GM_setValue('zmail_address', address); GM_setValue('zmail_address2', address);
                    GM_setValue('zmail_email', email); GM_setValue('zmail_email2', email);
                }
            }
        }
        if (!address) { makeBtn('⚠️ 未找到邮箱信息', () => { }); toast('⚠️ 未找到 Zmail 地址\n请从注册页重新开始'); return; }
        makeBtn('📬 轮询验证码...', () => { }); setBtn('📬 轮询验证码...', true); toast(`轮询中...\n邮箱: ${email}`);
        const code = await zmailPollCode(address);
        if (!code) { setBtn('❌ 超时', false); toast('❌ 超时，未收到验证码'); return; }
        log(`验证码: ${code}`); toast(`✅ 验证码: ${code}\n等待输入框...`); setBtn(`✅ ${code}`, true);
        let codeInput = null;
        try { codeInput = await waitFor('input[name="code"]', 8000); } catch { }
        if (!codeInput) codeInput = document.querySelector('input[inputmode="numeric"],input[autocomplete="one-time-code"]');
        if (!codeInput) { toast(`❌ 找不到输入框\n验证码: ${code}\n请手动输入`); setBtn(`手动输入: ${code}`, false); return; }
        let r = 0; while ((codeInput.disabled || codeInput.readOnly) && r++ < 20) await sleep(200);
        codeInput.focus(); setNativeValue(codeInput, code);
        toast(`✅ 验证码已填入: ${code}\n等待提交...`); await sleep(1500);
        const sub = document.querySelector('button[value="validate"],button[data-dd-action-name="Continue"]');
        sub && !sub.disabled ? sub.click() : (toast(`✅ 已填入: ${code}\n请手动点击"继续"`), setBtn(`请手动提交: ${code}`, false));
        GM_setValue('zmail_address', ''); GM_setValue('zmail_address2', '');
    }

    async function handleAboutYouPage() {
        log('个人信息页');
        GM_setValue('oai_last_path', '/about-you');
        try { await waitFor('input[name="name"],input[name="age"]', 8000); } catch { }
        await sleep(300);

        makeBtn('👤 自动填写信息', async () => {
            setBtn('填写中...', true);
            try {
                const name = randomName();

                // 填姓名
                const nameInput = document.querySelector('input[name="name"]');
                if (nameInput) { nameInput.focus(); setNativeValue(nameInput, name); await sleep(200); }

                const ageInput = document.querySelector('input[name="age"]');
                const dateField = document.querySelector('[role="spinbutton"][data-type="year"]');
                const hiddenBd = document.querySelector('input[name="birthday"]');

                if (ageInput) {
                    // ── 形态1：年龄输入框 ──
                    const age = randomAge();
                    log(`年龄模式 name=${name} age=${age}`);
                    ageInput.focus(); setNativeValue(ageInput, String(age));
                    toast(`👤 姓名: ${name}\n🔢 年龄: ${age}\n等待提交...`);

                } else if (dateField) {
                    // ── 形态2：日期选择器 ──
                    const bd = randomBirthday2004();
                    log(`日期模式 name=${name} birthday=${bd.iso}`);
                    if (hiddenBd) setNativeValue(hiddenBd, bd.iso);
                    const spins = document.querySelectorAll('[role="spinbutton"][data-type]');
                    for (const spin of spins) {
                        const type = spin.getAttribute('data-type');
                        const val = type === 'year' ? String(bd.year) : type === 'month' ? String(bd.month) : type === 'day' ? String(bd.day) : '';
                        if (!val) continue;
                        spin.focus(); await sleep(100);
                        spin.textContent = '';
                        document.execCommand('selectAll', false, null);
                        document.execCommand('insertText', false, val);
                        spin.dispatchEvent(new InputEvent('input', { bubbles: true, data: val }));
                        spin.dispatchEvent(new Event('change', { bubbles: true }));
                        await sleep(150);
                    }
                    toast(`👤 姓名: ${name}\n🎂 生日: ${bd.iso}\n等待提交...`);
                } else {
                    throw new Error('找不到年龄或生日输入框');
                }

                setBtn('✅ 信息已填写', true);
                await sleep(1200);

                const submitBtn = document.querySelector('button[data-dd-action-name="Continue"],button[type="submit"]');
                if (!submitBtn || submitBtn.disabled) {
                    toast('✅ 信息已填写\n请手动点击"完成帐户创建"');
                    setBtn('请手动点击完成', false);
                    return;
                }

                submitBtn.click();
                toast('✅ 已提交，检测确认弹窗...');
                setBtn('⏳ 等待弹窗...', true);

                // ★ 等待年龄确认弹窗（最多 4 秒），出现就点"确定"
                const dialogConfirm = await (async () => {
                    const t0 = Date.now();
                    while (Date.now() - t0 < 4000) {
                        const dlg = document.querySelector('[class*="_ageDialog_"] button[type="submit"]');
                        if (dlg && !dlg.disabled) return dlg;
                        await sleep(200);
                    }
                    return null;
                })();

                if (dialogConfirm) {
                    log('检测到年龄确认弹窗，点击确定');
                    toast('✅ 检测到确认弹窗\n点击"确定"...');
                    dialogConfirm.click();
                    await sleep(500);
                }

                // ★ 等待页面离开 /about-you（最多 8 秒）
                const result = await new Promise(resolve => {
                    const t0 = Date.now();
                    const tick = () => {
                        if (location.pathname !== '/about-you') return resolve('left');
                        if (Date.now() - t0 > 8000) return resolve('stayed');
                        setTimeout(tick, 300);
                    };
                    tick();
                });

                log(`about-you 结果: ${result}`);

                if (result === 'stayed') {
                    // 页面未动 → 服务器又返回了新表单，重新处理
                    log('页面未离开，重新处理 about-you');
                    toast('🔄 检测到新表单，重新填写...');
                    cleanUI();
                    await sleep(500);
                    handleAboutYouPage();
                } else {
                    // 页面已跳走 → 保存账号
                    const email = GM_getValue('zmail_email', '') || GM_getValue('zmail_email2', '');
                    const password = GM_getValue('zmail_password', '');
                    toast(`✅ 页面已跳转\n正在保存账号...\n邮箱: ${email}`);
                    const saved = await zmailSaveAccount();
                    toast(saved
                        ? `✅ 账号已保存到 Zmail!\n邮箱: ${email}\n密码: ${password}`
                        : `⚠️ 提交成功但保存失败\n邮箱: ${email}\n密码: ${password}\n请手动记录！`
                    );
                    setBtn(saved ? '✅ 已保存' : '⚠️ 保存失败', true);
                }

            } catch (e) {
                log(`个人信息页错误: ${e.message}`);
                toast(`❌ ${e.message}`);
                setBtn('👤 重试', false);
            }
        });
        await sleep(800);
        if (btnEl && !btnEl.disabled) btnEl.click();
    }

    async function handleConsentPage() {
        log('授权确认页');
        GM_setValue('oai_last_path', location.pathname);
        try { await waitFor('button[data-dd-action-name="Continue"]', 8000); } catch { }
        await sleep(500);
        makeBtn('✅ 自动确认授权', async () => {
            setBtn('确认中...', true); toast('正在点击"继续"完成授权...');
            try {
                const btn = document.querySelector('button[data-dd-action-name="Continue"],button[type="submit"]');
                if (!btn || btn.disabled) throw new Error('找不到确认按钮');
                btn.click();
                toast('✅ 授权已确认！\n注册流程完成 🎉');
                setBtn('✅ 注册完成 🎉', true);
            } catch (e) { toast(`❌ ${e.message}`); setBtn('✅ 手动点击继续', false); }
        });
        await sleep(800);
        if (btnEl && !btnEl.disabled) btnEl.click();
    }

    // ── 路由分发 ─────────────────────────────────────
    function dispatch() {
        const path = location.pathname;
        log(`当前路径: ${path}`);
        cleanUI();
        if (isErrorPage()) { handleErrorPage(); return; }
        if (path.startsWith('/create-account/password')) handlePasswordPage();
        else if (path === '/create-account' || /^\/create-account(\?.*)?$/.test(path)) handleCreateAccountPage();
        else if (path.startsWith('/log-in')) handleLoginPage();
        else if (path.startsWith('/email-verification')) handleVerificationPage();
        else if (path.startsWith('/about-you')) handleAboutYouPage();
        else if (path.startsWith('/sign-in-with-chatgpt')) handleConsentPage();
    }

    // SPA 路由拦截
    const _push = history.pushState.bind(history), _replace = history.replaceState.bind(history);
    history.pushState = (...a) => { _push(...a); setTimeout(dispatch, 600); };
    history.replaceState = (...a) => { _replace(...a); setTimeout(dispatch, 600); };
    window.addEventListener('popstate', () => setTimeout(dispatch, 600));

    // MutationObserver 兜底
    let errTimer = null;
    const errObserver = new MutationObserver(() => {
        clearTimeout(errTimer);
        errTimer = setTimeout(() => {
            if (isErrorPage() && !btnEl?.textContent?.includes('重试')) { cleanUI(); handleErrorPage(); }
        }, 800);
    });

    if (document.body) {
        errObserver.observe(document.body, { childList: true, subtree: false });
        setTimeout(dispatch, 900);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            errObserver.observe(document.body, { childList: true, subtree: false });
            setTimeout(dispatch, 900);
        });
    }

})();