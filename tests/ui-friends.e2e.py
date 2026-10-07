# Two real browsers (Playwright for Python) play the whole friends flow against a real server:
# profile -> add friend -> accept -> pick friend -> invitation -> accept -> both in the same room.
# Not part of `npm test` because it needs a browser:  pip install playwright && playwright install chromium
#   python3 tests/ui-friends.e2e.py          (run from the project root)
import subprocess, os, sys, time, tempfile, shutil, urllib.request
from playwright.sync_api import sync_playwright, expect

PORT = 3300
BASE = f"http://localhost:{PORT}"
data_dir = tempfile.mkdtemp(prefix="ui-e2e-")
srv = subprocess.Popen([sys.executable and "node", "--import", "tsx", "server.ts"], cwd=os.getcwd(),
                       env={**os.environ, "PORT": str(PORT), "DATA_DIR": data_dir}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
results = []
A = B = None
RUN = sys.argv[1] if len(sys.argv) > 1 else '0'
def check(name, ok, extra=""):
    results.append(ok); print(("PASS" if ok else "FAIL"), "-", name, ("" if ok else extra))

try:
    for _ in range(120):
        try:
            urllib.request.urlopen(BASE + "/api/ice-servers", timeout=1); break
        except Exception: time.sleep(0.5)

    with sync_playwright() as p:
        br = p.chromium.launch()
        mk = lambda: br.new_context(viewport={"width": 390, "height": 844}, locale="ar-EG")
        ca, cb = mk(), mk()
        A, B = ca.new_page(), cb.new_page()
        errs = []
        for pg, nm in ((A, "A"), (B, "B")):
            pg.on("pageerror", lambda e, nm=nm: errs.append(f"{nm}: {e}"))
        A.goto(BASE); B.goto(BASE)
        T = 20000

        # --- Home
        expect(A.get_by_text("العب مع أصدقائك").first).to_be_visible(timeout=T)
        check("Home: 'العب مع أصدقائك' is the main button", True)
        check("Home: room code is only a fallback (small 'انضم بكود' / 'إنشاء غرفة بكود')", A.get_by_text("انضم بكود").count() >= 1 and A.get_by_text("إنشاء غرفة بكود").count() == 1)
        A.screenshot(path="/tmp/01_home_new.png")

        # --- A: first use -> one-time profile
        A.get_by_role("button", name="العب مع أصدقائك").click()
        expect(A.get_by_text("اعمل ملفك مرة واحدة")).to_be_visible(timeout=T)
        A.get_by_placeholder("اكتب اسمك هنا...").fill("سعيد")
        A.get_by_placeholder("saeed123").fill("saeed123")
        expect(A.get_by_text("✓")).to_be_visible(timeout=T)   # live availability check
        A.screenshot(path="/tmp/02_profile_setup.png")
        A.get_by_role("button", name="يلا نبدأ").click()
        expect(A.get_by_text("اختر أصدقاء للعب")).to_be_visible(timeout=T)
        check("A: profile created once, lands on 'اختر أصدقاء للعب' (empty: no friends yet)", A.get_by_text("لسه ماضفتش أصدقاء").is_visible())

        # --- B: profile via the Friends button
        B.get_by_role("button", name="الأصدقاء").first.click()
        B.get_by_placeholder("اكتب اسمك هنا...").fill("أحمد")
        B.get_by_placeholder("saeed123").fill("ahmed99")
        B.get_by_role("button", name="يلا نبدأ").click()
        expect(B.get_by_text("@ahmed99").first).to_be_visible(timeout=T)
        check("B: Friends screen shows own @ID", True)

        # --- A adds B by ID
        A.get_by_role("button", name="إضافة صديق").click()
        expect(A.get_by_placeholder("ID صاحبك")).to_be_visible(timeout=T)
        A.get_by_placeholder("ID صاحبك").fill("ahmed99")
        A.get_by_role("button", name="إضافة", exact=True).click()
        expect(A.get_by_text("اتبعت طلب الصداقة لـ أحمد")).to_be_visible(timeout=T)
        check("A: friend request sent from inside the game", True)

        # --- B sees the request and accepts
        expect(B.get_by_text("طلبات صداقة (1)")).to_be_visible(timeout=T)
        B.screenshot(path="/tmp/03_friend_request.png")
        B.get_by_role("button", name="قبول").click()
        expect(B.get_by_text("أصدقائي (1)")).to_be_visible(timeout=T)
        check("B: accepted -> sees سعيد in the friend list with live status", B.get_by_text("سعيد").first.is_visible() and B.get_by_text("متصل").first.is_visible())
        B.get_by_role("button", name="رجوع").click()

        # --- A: pick the friend
        A.get_by_role("button", name="رجوع").click()          # add-friend screen -> setup? (we came via setup->friends)
        # A may be on FRIENDS (came from empty-state button) -> go home then to setup
        for _ in range(3):
            if A.get_by_text("اختر أصدقاء للعب").count(): break
            if A.get_by_role("button", name="رجوع").count(): A.get_by_role("button", name="رجوع").click()
            if A.get_by_role("button", name="العب مع أصدقائك").count(): A.get_by_role("button", name="العب مع أصدقائك").click()
        expect(A.get_by_text("أحمد").first).to_be_visible(timeout=T)
        check("A: friend list shows أحمد as 🟢 متصل", A.get_by_text("متصل").first.is_visible())
        A.get_by_text("أحمد").first.click()
        expect(A.get_by_role("button", name="ابدأ اللعبة (2 لاعبين)")).to_be_visible(timeout=T)
        A.screenshot(path="/tmp/04_pick_friends.png")
        A.get_by_role("button", name="ابدأ اللعبة (2 لاعبين)").click()
        expect(A.get_by_text("ادعُ خصمك للعب")).to_be_visible(timeout=T)
        check("A: room created (no code step) and lands in the lobby", True)

        # --- B receives the in-game invitation
        expect(B.get_by_text("دعاك للعب")).to_be_visible(timeout=T)
        check("B: invitation card 'سعيد دعاك للعب' appears", B.get_by_text("سعيد").first.is_visible())
        B.screenshot(path="/tmp/05_invite_card.png")
        A.screenshot(path="/tmp/06_host_lobby.png")
        B.get_by_role("button", name="قبول").click()

        # --- B is in the room; A sees B joined
        expect(A.get_by_text("2/2 لاعبين")).to_be_visible(timeout=T)   # stable: the transient "joined" label disappears with the invite panel
        check("A: host lobby shows 2/2 players and أحمد in the room", A.get_by_text("أحمد").count() > 0)
        expect(B.get_by_text("إيه اللي معايا؟").first).to_be_visible(timeout=T)
        B.wait_for_timeout(3000)
        B.screenshot(path="/tmp/07_guest_in_room.png")
        sees_host = B.get_by_text("سعيد").count() > 0
        print("   B lobby text after 3s:", B.locator("main, body").first.inner_text().replace("\n"," | ")[:300])
        check("B: after 3s the lobby shows the host (سعيد)", sees_host)
        check("B: lobby is not stuck on '1/2 لاعبين'", B.get_by_text("2/2 لاعبين").count() > 0)
        # host can start now
        start = A.get_by_role("button", name="بدء اختيار الصور السرية")
        check("A: 'start' button is enabled once B joined", start.is_enabled())

        # --- friends see "playing"
        # (both are in a game; verify the status the server holds via a third look at the Friends screen of A)
        # --- Quick play: leave, then 'العب مرة أخرى' shows أحمد
        A.get_by_role("button", name="رجوع").first.click()
        expect(A.get_by_text("العب مرة أخرى")).to_be_visible(timeout=T)
        check("A: Home now shows 'العب مرة أخرى' with أحمد", A.get_by_text("أحمد").first.is_visible())
        A.screenshot(path="/tmp/08_home_quickplay.png")

        check("no uncaught page errors", len(errs) == 0, str(errs))
        br.close()
except Exception as e:
    import traceback; traceback.print_exc(); results.append(False)
    for nm, pg in (('A', A), ('B', B)):
        try: pg.screenshot(path=f'/tmp/FAIL_{RUN}_{nm}.png'); print(f'   [{nm} body]', pg.locator('body').inner_text().replace(chr(10), ' | ')[:350])
        except Exception: pass
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()
    shutil.rmtree(data_dir, ignore_errors=True)
    print(f"\nSUMMARY: {sum(results)}/{len(results)} passed")
