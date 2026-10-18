/* tebCapture desktop receiver — in-page i18n string tables (en + fa).
   =====================================================================
   The receiver page is a self-contained surface with only two languages,
   so the tables ride in this one asset (loaded like tebcapture-mirror.js /
   tebcapture-gateway.js) instead of the 40-locale JSON fetch that
   dictate.html uses. English is ALSO baked into the DOM as the default —
   these tables only re-skin it. Farsi is native founder-grade and mirrors
   the sibling tebDictate glossary (رایانه / گوشی / رمزگذاری سرتاسری).

   Keys ending _html carry inline markup (<b>, <br>, a <span>/<a> the page
   updates by id). {name} tokens are filled by t(key,{name:…}) in the page.
   The allowed security sentence (footer/print claim) keeps identical
   meaning across languages: encrypted in transit + at rest (AES), never
   trained on, never sold — plus the E2EE line (the relay holds ciphertext
   only). No new marketing claims.
   ===================================================================== */
(function () {
  "use strict";

  var RTL = { fa: 1 };
  var NATIVE = { en: "English", fa: "فارسی" };
  var SUPPORTED = ["en", "fa"];

  // Resolve a BCP-47-ish tag to a supported locale, or null. fa* → fa, en* → en,
  // everything else → null so the caller falls through to English (default intact).
  function resolve(tag) {
    if (!tag) return null;
    var t = String(tag).trim().toLowerCase();
    if (!t) return null;
    var base = t.split("-")[0];
    if (base === "fa" || base === "per" || base === "fas") return "fa";
    if (base === "en") return "en";
    return null;
  }

  var EN = {
    doc_title: "tebCapture — your phone is an encrypted camera",
    skip: "Skip to the main content",
    tools_label: "Display options",
    eyebrow: "tebCapture · phone camera → this computer",
    tool_larger: "Larger text",
    tool_dark: "Dark",
    tool_light: "Light",
    tool_help: "Help me",
    lang_switch_aria: "Change language",
    h1_sr: "tebCapture — your phone is an encrypted camera. Send video to this computer.",
    step_of: "Step {n} of 4",
    done_word: "Done",

    // 1 · folder
    s1_no: "Step 1 of 4",
    s1_h: "Where should your videos go?",
    s1_p_html: "Pick a folder on this computer. Every video from your phone will land there. <b>You only do this once.</b>",
    s1_li1: "Click the green button.",
    s1_li2_html: "Pick <b>Movies</b> (or any folder you like).",
    s1_li3_html: "Click <b>Allow</b> when asked.",
    s1_pick: "Choose a folder",
    s1_safari_html: "Using <b>Safari</b>? It can't save video to a folder. No problem — we'll offer a download each time you stop recording. Click <b>Skip this step</b>.",
    s1_skip: "Skip this step (Safari)",

    // 2 · pair
    s2_no: "Step 2 of 4",
    s2_h: "Show this code to your phone.",
    s2_p_html: "Open <b>tebCapture</b> on your iPhone, tap <b>Pair</b>, and point it at the square below. Wait for the green check.",
    s2_legend: "How long should this computer remember your phone?",
    s2_guest_t: "Just this once",
    s2_guest_d: "Forget the phone when you close this window.",
    s2_remember_t: "Remember this computer",
    s2_remember_d: "Next time, the phone finds this computer by itself. No code.",
    s2_name_label: "What should your phone call this computer?",
    s2_name_default: "This Mac",
    qr_aria: "Pairing code. If you can't scan it, type the code below into the app.",
    qr_expired_t: "This code has expired",
    qr_expired_d: "Nothing was lost — make a new code.",
    newcode: "Make a new code",
    s2_cantscan_html: "<b>Can't scan? Or type this code in the app:</b>",
    s2_goodfor_html: "Good for <b id=\"timer\">10:00</b>.",
    back_pair_to_first: "← Back",

    // 3 · ready
    s3_no: "Step 3 of 4",
    s3_ready_word: "Ready",
    paired: "Paired with your phone",
    s3_h_html: "This computer is ready.<br>Leave this window open.",
    s3_p_html: "Now press <b>Record</b> on your phone whenever you like. The video comes here by itself. Videos save to <span class=\"path\" id=\"readyPath\">the folder you chose</span>.",
    readyPath_default: "the folder you chose",
    back_ready_to_pair: "← Pair a different phone",

    // gateway (present only when TEBCAPTURE_GATEWAY on)
    gw_h: "Personal models — optional",
    gw_p_html: "Your phone asks; <b>this computer answers using YOUR key.</b> Your key is encrypted and stays on this computer — it is never sent to your phone or the relay. Model providers see the request text under their own terms.",
    gw_saved_html: "To use personal models, pair with <b>“Remember this computer.”</b> Guest codes can’t sign these requests.",
    gw_pass_label: "Passphrase to protect your keys on this computer",
    gw_pass_ph: "Choose or enter passphrase",
    gw_unlock: "Unlock",
    gw_provider: "Provider",
    gw_model: "Model",
    gw_key_label: "API key (stays on this computer)",
    gw_key_ph: "Paste your provider API key",
    gw_save: "Save key",
    gw_providers_aria: "Providers set up on this computer",
    gw_answered_h: "Requests answered",
    gw_no_requests: "No requests yet.",
    gw_lock: "Lock keys",
    gw_min6: "Use at least 6 characters.",
    gw_unlocking: "Unlocking…",
    gw_unlocked_ok: "Keys unlocked for this session.",
    gw_pass_bad: "That passphrase doesn’t match the keys saved here.",
    gw_locked_ok: "Keys locked.",
    gw_paste_first: "Paste your API key first.",
    gw_saved_key_ok: "Saved your {label} key on this computer.",
    gw_unlock_first: "Unlock the vault before saving a key.",
    gw_removed_ok: "Removed the {label} key.",
    gw_ready_nokey: "Ready · no key needed",
    gw_key_saved: "Key saved ✓",
    gw_no_key_yet: "No key yet",
    gw_remove: "Remove",
    gw_limits: "Daily limit ${budget} · {rate} requests per minute · first use per project asks you first.",

    // 4 · recording
    s4_no: "Step 4 of 4",
    s4_recording_word: "Recording",
    s4_h: "Video is arriving. Nothing to click.",
    s4_p_html: "Your phone is sending encrypted video right now. Stop the recording <b>on your phone</b> when you're done.",
    s4_writing_html: "Writing to <span class=\"path\" id=\"recPath\">your folder</span>",
    recPath_default: "your folder",
    facts_aria: "Live transfer details",
    fact_received: "received so far",
    fact_pieces: "pieces",
    fact_confirmed: "last confirmed",

    // 5 · saved
    s5_saved_word: "Saved",
    s5_h: "Your video is on this computer.",
    donePath_default: "your folder",
    doneStats_default: "Every piece confirmed.",
    save_mp4: "Save video (.mp4)",
    record_another: "Record another",

    // problem screens
    p_relay_badge: "Can't reach the relay",
    p_relay_h: "Can't reach the relay.",
    p_relay_p_html: "Check this computer's internet, then try again. <b>Nothing on the phone is lost</b> — the phone keeps any video and sends it when this computer is online again.",
    p_relay_li1: "Check that Wi-Fi is on.",
    p_relay_li2: "Click the green button.",
    retry: "Retry",
    p_folder_badge: "Needs one click",
    p_folder_h: "This browser needs permission to write to your folder again.",
    p_folder_p_html: "Browsers sometimes forget after a restart. <b>Your video is safe on your phone.</b> Everything received so far is already in the folder. Choose the folder again and it will keep arriving.",
    p_folder_btn: "Choose the folder again",
    p_disk_badge: "Out of space",
    p_disk_h: "This computer is out of space.",
    p_disk_p_html: "Free up space or pick another drive. <b>Your phone is holding the rest until there is room.</b>",
    p_disk_li1: "Empty the Trash, or move some files to another drive.",
    p_disk_li2: "Click the green button.",
    p_disk_btn: "Choose another folder",

    // recent
    recent_h: "Recent",
    recent_sub: "The latest photos and videos from your phone, in your folder.",
    badge_saved: "Saved",
    badge_receiving: "Receiving",
    badge_working: "Working",
    badge_waiting: "Waiting",
    badge_lowspace: "Low space",
    badge_needslook: "Needs a look",
    unsorted: "Unsorted",
    take: "Take {n}",
    photo: "Photo",
    video: "Video",
    open_folder: "Open folder",

    // reassurance + disambiguator
    reassure: "If this computer is asleep, the phone keeps the video and sends it when you're back.",
    dictate_hint_html: "<a href=\"/dictate\">Looking for dictation? That's tebDictate.</a>",

    // footer (the allowed security sentence — meaning fixed across languages)
    footer_claim: "End-to-end encrypted between your phone and this computer. Encrypted in transit and at rest (AES). Never used for training. Never sold.",
    footer_by: "tebCapture · by tebIQ",

    // help dialog
    help_title: "Help me",
    help_p1_html: "<b>The idea:</b> your phone is the camera. This computer is where the video goes. The square code tells the phone which computer is yours.",
    help_p2_html: "<b>Code won't scan?</b> Type the letters under it into the app. Same thing.",
    help_p3_html: "<b>Pressed Record and nothing happened?</b> Look here. It should say <b>Recording</b> with a red dot. If not, check this window is open and the computer is online.",
    help_p4_html: "<b>Computer was asleep?</b> Relax. The phone kept the video and sends it when you're back.",
    help_p5_html: "<b>Still stuck?</b> Print the setup sheet and hand it to whoever helps you with computers. There is nothing on this page they can break.",
    help_print: "Print setup sheet",
    help_close: "Close",

    // print sheet
    print_h1: "How to set up your computer for tebCapture",
    print_intro: "Four steps. About two minutes. Do this once.",
    print_li1_html: "<b>Open this page</b> on the computer: <b id=\"printUrl\">this web page</b>, in Chrome or Edge.",
    print_li2_html: "<b>Choose a folder.</b> Click the green “Choose a folder” button, pick <b>Movies</b>, click <b>Allow</b>.",
    print_li3_html: "<b>Show the code to your phone.</b> Open tebCapture on the iPhone, tap Pair, point it at the square. Can't scan? Type the code under the square.",
    print_li4_html: "<b>Leave the window open.</b> Press Record on the phone. The video saves itself into your folder.",
    print_printurl_default: "this web page",
    print_box1_html: "<b>Computer asleep or offline?</b> Nothing is lost. The phone keeps the video and sends it when the window is open again.",
    print_box2_html: "<b>Code expired?</b> Click “Make a new code”. Nothing else changes.",
    print_claim: "End-to-end encrypted between your phone and this computer. Encrypted in transit and at rest (AES). Never used for training. Never sold.",

    // live region (screen-reader announcements) + dynamic status
    live_first: "Step 1 of 4. Where should your videos go? Choose a folder.",
    live_pair: "Step 2 of 4. Show this code to your phone. Good for ten minutes.",
    live_ready: "Ready. This computer is paired. Leave this window open.",
    live_rec: "Recording. Video is arriving. Nothing to click.",
    live_done: "Saved. Your video is on this computer.",
    "live_p-relay": "Can't reach the relay. Check this computer's internet, then try again.",
    "live_p-folder": "This browser needs permission to write to your folder again. Choose the folder again.",
    "live_p-disk": "This computer is out of space. Free up space, then choose another folder.",
    live_easy_on: "Larger text is on.",
    live_easy_off: "Larger text is off.",
    live_lang: "Language changed to English.",
    live_expired: "The pairing code expired. Click Make a new code.",
    live_newcode: "New code ready. Good for ten minutes.",
    live_remember_selected: "Remember this computer selected. Give it a name.",
    live_guest_selected: "Just this once selected.",
    live_open_folder: "Your videos are in the folder you chose, under tebCapture.",
    qr_placeholder: "(set the relay origin to generate a live code)",
    mem_suffix: "(download when you stop)",
    folder_word: "your folder",
    done_stats: "{mb} · {n} pieces · every piece confirmed.",
    ack_justnow: "just now",
    unit_mb: "MB",
  };

  var FA = {
    doc_title: "tebCapture — گوشی شما یک دوربین رمزگذاری‌شده است",
    skip: "پرش به محتوای اصلی",
    tools_label: "گزینه‌های نمایش",
    eyebrow: "tebCapture · دوربین گوشی ← این رایانه",
    tool_larger: "متن بزرگ‌تر",
    tool_dark: "تیره",
    tool_light: "روشن",
    tool_help: "کمکم کن",
    lang_switch_aria: "تغییر زبان",
    h1_sr: "tebCapture — گوشی شما یک دوربین رمزگذاری‌شده است. ویدیو را به این رایانه بفرستید.",
    step_of: "گام {n} از ۴",
    done_word: "تمام",

    // 1 · folder
    s1_no: "گام ۱ از ۴",
    s1_h: "ویدیوهای شما کجا ذخیره شوند؟",
    s1_p_html: "روی این رایانه یک پوشه انتخاب کنید. هر ویدیویی از گوشی شما همان‌جا ذخیره می‌شود. <b>این کار را فقط یک‌بار انجام می‌دهید.</b>",
    s1_li1: "روی دکمهٔ سبز کلیک کنید.",
    s1_li2_html: "<b>Movies</b> را انتخاب کنید (یا هر پوشه‌ای که دوست دارید).",
    s1_li3_html: "وقتی پرسیده شد، روی <b>Allow</b> کلیک کنید.",
    s1_pick: "انتخاب یک پوشه",
    s1_safari_html: "از <b>Safari</b> استفاده می‌کنید؟ Safari نمی‌تواند ویدیو را در پوشه ذخیره کند. مشکلی نیست — هر بار که ضبط را متوقف کنید، فایل را برای دانلود پیشنهاد می‌دهیم. روی <b>پرش از این گام</b> کلیک کنید.",
    s1_skip: "پرش از این گام (Safari)",

    // 2 · pair
    s2_no: "گام ۲ از ۴",
    s2_h: "این کد را به گوشی‌تان نشان دهید.",
    s2_p_html: "<b>tebCapture</b> را روی آیفون باز کنید، روی <b>جفت‌سازی</b> بزنید و آن را به سمت مربع پایین بگیرید. تا دیدن تیک سبز صبر کنید.",
    s2_legend: "این رایانه تا چه مدت گوشی شما را به خاطر بسپارد؟",
    s2_guest_t: "فقط همین یک‌بار",
    s2_guest_d: "با بستن این پنجره، گوشی فراموش می‌شود.",
    s2_remember_t: "این رایانه را به خاطر بسپار",
    s2_remember_d: "دفعهٔ بعد، گوشی خودش این رایانه را پیدا می‌کند. بدون کد.",
    s2_name_label: "گوشی شما این رایانه را چه بنامد؟",
    s2_name_default: "این مک",
    qr_aria: "کد جفت‌سازی. اگر نمی‌توانید آن را اسکن کنید، کد پایین را در برنامه تایپ کنید.",
    qr_expired_t: "این کد منقضی شده است",
    qr_expired_d: "چیزی از دست نرفت — یک کد تازه بسازید.",
    newcode: "ساخت کد تازه",
    s2_cantscan_html: "<b>نمی‌توانید اسکن کنید؟ یا این کد را در برنامه تایپ کنید:</b>",
    s2_goodfor_html: "به مدت <b id=\"timer\">۱۰:۰۰</b> معتبر است.",
    back_pair_to_first: "→ بازگشت",

    // 3 · ready
    s3_no: "گام ۳ از ۴",
    s3_ready_word: "آماده",
    paired: "با گوشی شما جفت شد",
    s3_h_html: "این رایانه آماده است.<br>این پنجره را باز نگه دارید.",
    s3_p_html: "حالا هر وقت خواستید روی گوشی <b>ضبط</b> را بزنید. ویدیو خودش به اینجا می‌آید. ویدیوها در <span class=\"path\" id=\"readyPath\">پوشه‌ای که انتخاب کردید</span> ذخیره می‌شوند.",
    readyPath_default: "پوشه‌ای که انتخاب کردید",
    back_ready_to_pair: "→ جفت‌سازی با گوشی دیگر",

    // gateway
    gw_h: "مدل‌های شخصی — اختیاری",
    gw_p_html: "گوشی شما درخواست می‌دهد؛ <b>این رایانه با کلید خودِ شما پاسخ می‌دهد.</b> کلید شما رمزگذاری‌شده است و روی همین رایانه می‌ماند — هرگز به گوشی یا رله فرستاده نمی‌شود. ارائه‌دهندگان مدل، متنِ درخواست را طبق شرایط خودشان می‌بینند.",
    gw_saved_html: "برای استفاده از مدل‌های شخصی، با گزینهٔ <b>«این رایانه را به خاطر بسپار»</b> جفت شوید. کدهای مهمان نمی‌توانند این درخواست‌ها را امضا کنند.",
    gw_pass_label: "عبارت عبور برای محافظت از کلیدهایتان روی این رایانه",
    gw_pass_ph: "یک عبارت عبور انتخاب یا وارد کنید",
    gw_unlock: "باز کردن قفل",
    gw_provider: "ارائه‌دهنده",
    gw_model: "مدل",
    gw_key_label: "کلید API (روی همین رایانه می‌ماند)",
    gw_key_ph: "کلید API ارائه‌دهنده‌تان را بچسبانید",
    gw_save: "ذخیرهٔ کلید",
    gw_providers_aria: "ارائه‌دهندگان تنظیم‌شده روی این رایانه",
    gw_answered_h: "درخواست‌های پاسخ‌داده‌شده",
    gw_no_requests: "هنوز درخواستی نیست.",
    gw_lock: "قفل کردن کلیدها",
    gw_min6: "دست‌کم ۶ نویسه استفاده کنید.",
    gw_unlocking: "در حال باز کردن قفل…",
    gw_unlocked_ok: "کلیدها برای این جلسه باز شدند.",
    gw_pass_bad: "این عبارت عبور با کلیدهای ذخیره‌شده در اینجا مطابقت ندارد.",
    gw_locked_ok: "کلیدها قفل شدند.",
    gw_paste_first: "ابتدا کلید API خود را بچسبانید.",
    gw_saved_key_ok: "کلید {label} شما روی این رایانه ذخیره شد.",
    gw_unlock_first: "پیش از ذخیرهٔ کلید، قفل مخزن را باز کنید.",
    gw_removed_ok: "کلید {label} حذف شد.",
    gw_ready_nokey: "آماده · بدون نیاز به کلید",
    gw_key_saved: "کلید ذخیره شد ✓",
    gw_no_key_yet: "هنوز کلیدی نیست",
    gw_remove: "حذف",
    gw_limits: "سقف روزانه {budget} دلار · {rate} درخواست در دقیقه · اولین استفاده در هر پروژه از شما می‌پرسد.",

    // 4 · recording
    s4_no: "گام ۴ از ۴",
    s4_recording_word: "در حال ضبط",
    s4_h: "ویدیو در حال رسیدن است. کاری لازم نیست.",
    s4_p_html: "گوشی شما همین حالا ویدیوی رمزگذاری‌شده می‌فرستد. وقتی کارتان تمام شد، ضبط را <b>روی گوشی</b> متوقف کنید.",
    s4_writing_html: "در حال نوشتن در <span class=\"path\" id=\"recPath\">پوشهٔ شما</span>",
    recPath_default: "پوشهٔ شما",
    facts_aria: "جزئیات زندهٔ انتقال",
    fact_received: "دریافت‌شده تا کنون",
    fact_pieces: "قطعه",
    fact_confirmed: "آخرین تأییدشده",

    // 5 · saved
    s5_saved_word: "ذخیره شد",
    s5_h: "ویدیوی شما روی این رایانه است.",
    donePath_default: "پوشهٔ شما",
    doneStats_default: "هر قطعه تأیید شد.",
    save_mp4: "ذخیرهٔ ویدیو (.mp4)",
    record_another: "ضبط یکی دیگر",

    // problem screens
    p_relay_badge: "دسترسی به رله ممکن نیست",
    p_relay_h: "دسترسی به رله ممکن نیست.",
    p_relay_p_html: "اینترنت این رایانه را بررسی کنید و دوباره تلاش کنید. <b>هیچ‌چیز روی گوشی از دست نمی‌رود</b> — گوشی هر ویدیویی را نگه می‌دارد و وقتی این رایانه دوباره آنلاین شد، آن را می‌فرستد.",
    p_relay_li1: "بررسی کنید که Wi-Fi روشن است.",
    p_relay_li2: "روی دکمهٔ سبز کلیک کنید.",
    retry: "تلاش دوباره",
    p_folder_badge: "به یک کلیک نیاز است",
    p_folder_h: "این مرورگر برای نوشتن دوباره در پوشهٔ شما به اجازه نیاز دارد.",
    p_folder_p_html: "مرورگرها گاهی پس از راه‌اندازی مجدد فراموش می‌کنند. <b>ویدیوی شما روی گوشی‌تان امن است.</b> هر آنچه تا کنون دریافت شده، از پیش در پوشه است. دوباره پوشه را انتخاب کنید تا رسیدن ادامه یابد.",
    p_folder_btn: "انتخاب دوبارهٔ پوشه",
    p_disk_badge: "فضای خالی نیست",
    p_disk_h: "فضای این رایانه پر است.",
    p_disk_p_html: "فضا خالی کنید یا درایو دیگری انتخاب کنید. <b>گوشی شما بقیه را تا زمانی که جا باز شود نگه می‌دارد.</b>",
    p_disk_li1: "سطل زباله را خالی کنید، یا چند فایل را به درایو دیگری منتقل کنید.",
    p_disk_li2: "روی دکمهٔ سبز کلیک کنید.",
    p_disk_btn: "انتخاب پوشهٔ دیگر",

    // recent
    recent_h: "اخیر",
    recent_sub: "تازه‌ترین عکس‌ها و ویدیوهای گوشی شما، در پوشه‌تان.",
    badge_saved: "ذخیره شد",
    badge_receiving: "در حال دریافت",
    badge_working: "در حال پردازش",
    badge_waiting: "در انتظار",
    badge_lowspace: "فضای کم",
    badge_needslook: "نیازمند بررسی",
    unsorted: "دسته‌بندی‌نشده",
    take: "برداشت {n}",
    photo: "عکس",
    video: "ویدیو",
    open_folder: "باز کردن پوشه",

    // reassurance + disambiguator
    reassure: "اگر این رایانه خواب باشد، گوشی ویدیو را نگه می‌دارد و وقتی برگشتید می‌فرستد.",
    dictate_hint_html: "<a href=\"/dictate\">دنبال دیکته می‌گردید؟ آن tebDictate است.</a>",

    // footer (meaning identical to English)
    footer_claim: "میان گوشی شما و این رایانه به‌صورت سرتاسری رمزگذاری می‌شود. در حین انتقال و هنگام ذخیره‌سازی رمزگذاری‌شده است (AES). هرگز برای آموزش استفاده نمی‌شود. هرگز فروخته نمی‌شود.",
    footer_by: "tebCapture · از tebIQ",

    // help dialog
    help_title: "کمکم کن",
    help_p1_html: "<b>ایده:</b> گوشی شما دوربین است. این رایانه جایی است که ویدیو به آن می‌رود. کد مربعی به گوشی می‌گوید کدام رایانه مالِ شماست.",
    help_p2_html: "<b>کد اسکن نمی‌شود؟</b> حرف‌های زیر آن را در برنامه تایپ کنید. همان کار را می‌کند.",
    help_p3_html: "<b>ضبط را زدید و اتفاقی نیفتاد؟</b> اینجا را نگاه کنید. باید <b>در حال ضبط</b> با یک نقطهٔ قرمز نشان دهد. اگر نه، مطمئن شوید این پنجره باز است و رایانه آنلاین است.",
    help_p4_html: "<b>رایانه خواب بود؟</b> خیالتان راحت. گوشی ویدیو را نگه داشت و وقتی برگردید می‌فرستد.",
    help_p5_html: "<b>هنوز گیر کرده‌اید؟</b> برگهٔ راه‌اندازی را چاپ کنید و به کسی که در کار با رایانه به شما کمک می‌کند بدهید. هیچ‌چیز روی این صفحه نیست که بتوانند خرابش کنند.",
    help_print: "چاپ برگهٔ راه‌اندازی",
    help_close: "بستن",

    // print sheet
    print_h1: "چطور رایانه‌تان را برای tebCapture آماده کنید",
    print_intro: "چهار گام. حدود دو دقیقه. یک‌بار انجامش دهید.",
    print_li1_html: "<b>این صفحه را باز کنید</b> روی رایانه: <b id=\"printUrl\">این صفحهٔ وب</b>، در Chrome یا Edge.",
    print_li2_html: "<b>یک پوشه انتخاب کنید.</b> روی دکمهٔ سبز «انتخاب یک پوشه» کلیک کنید، <b>Movies</b> را انتخاب کنید، روی <b>Allow</b> کلیک کنید.",
    print_li3_html: "<b>کد را به گوشی‌تان نشان دهید.</b> tebCapture را روی آیفون باز کنید، روی جفت‌سازی بزنید، آن را به سمت مربع بگیرید. اسکن نمی‌شود؟ کد زیر مربع را تایپ کنید.",
    print_li4_html: "<b>پنجره را باز نگه دارید.</b> روی گوشی ضبط را بزنید. ویدیو خودش در پوشهٔ شما ذخیره می‌شود.",
    print_printurl_default: "این صفحهٔ وب",
    print_box1_html: "<b>رایانه خواب یا آفلاین است؟</b> چیزی از دست نمی‌رود. گوشی ویدیو را نگه می‌دارد و وقتی پنجره دوباره باز شد می‌فرستد.",
    print_box2_html: "<b>کد منقضی شد؟</b> روی «ساخت کد تازه» کلیک کنید. چیز دیگری تغییر نمی‌کند.",
    print_claim: "میان گوشی شما و این رایانه به‌صورت سرتاسری رمزگذاری می‌شود. در حین انتقال و هنگام ذخیره‌سازی رمزگذاری‌شده است (AES). هرگز برای آموزش استفاده نمی‌شود. هرگز فروخته نمی‌شود.",

    // live region + dynamic status
    live_first: "گام ۱ از ۴. ویدیوهای شما کجا ذخیره شوند؟ یک پوشه انتخاب کنید.",
    live_pair: "گام ۲ از ۴. این کد را به گوشی‌تان نشان دهید. به مدت ده دقیقه معتبر است.",
    live_ready: "آماده. این رایانه جفت شد. این پنجره را باز نگه دارید.",
    live_rec: "در حال ضبط. ویدیو در حال رسیدن است. کاری لازم نیست.",
    live_done: "ذخیره شد. ویدیوی شما روی این رایانه است.",
    "live_p-relay": "دسترسی به رله ممکن نیست. اینترنت این رایانه را بررسی کنید و دوباره تلاش کنید.",
    "live_p-folder": "این مرورگر برای نوشتن دوباره در پوشهٔ شما به اجازه نیاز دارد. دوباره پوشه را انتخاب کنید.",
    "live_p-disk": "فضای این رایانه پر است. فضا خالی کنید، سپس پوشهٔ دیگری انتخاب کنید.",
    live_easy_on: "متن بزرگ‌تر روشن است.",
    live_easy_off: "متن بزرگ‌تر خاموش است.",
    live_lang: "زبان به فارسی تغییر کرد.",
    live_expired: "کد جفت‌سازی منقضی شد. روی ساخت کد تازه کلیک کنید.",
    live_newcode: "کد تازه آماده است. به مدت ده دقیقه معتبر است.",
    live_remember_selected: "«این رایانه را به خاطر بسپار» انتخاب شد. نامی به آن بدهید.",
    live_guest_selected: "«فقط همین یک‌بار» انتخاب شد.",
    live_open_folder: "ویدیوهای شما در پوشه‌ای که انتخاب کردید، زیر tebCapture هستند.",
    qr_placeholder: "(برای ساخت کد زنده، مبدأ رله را تنظیم کنید)",
    mem_suffix: "(هنگام توقف، دانلود می‌شود)",
    folder_word: "پوشهٔ شما",
    done_stats: "{mb} · {n} قطعه · هر قطعه تأیید شد.",
    ack_justnow: "همین حالا",
    unit_mb: "مگابایت",
  };

  var i18n = {
    SUPPORTED: SUPPORTED,
    RTL: RTL,
    NATIVE: NATIVE,
    resolve: resolve,
    S: { en: EN, fa: FA },
  };

  if (typeof window !== "undefined") window.tebCaptureI18n = i18n;
  if (typeof module !== "undefined" && module.exports) module.exports = i18n;
})();
