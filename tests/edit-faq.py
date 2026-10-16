"""One-off: add visible FAQ + FAQPage JSON-LD to index.html and 3d/index.html. Run from the site root."""
import html, json, sys
QA = [
 ("Are tebIQ, tebChart, and tebDictate the same company?", "Yes. All three are products of TebScribe LLC, a New York limited liability company founded by Dr. Mohammad Chelehmalzadeh, a practicing emergency medicine physician. tebIQ is the clinician product, tebChart is the patient product, and tebDictate is a free dictation tool anyone can use."),
 ("What is tebIQ?", "tebIQ is an AI medical scribe for clinicians. It captures the patient encounter and generates a structured clinical note — history, medical decision making, assessment and plan — shaped for the specialty the clinician actually practices. It runs in a web browser, on iPhone, and on Apple Watch. Encrypted in transit and at rest (AES). Never used for training. Never sold."),
 ("What is tebDictate, and is it really free?", "tebDictate turns any phone into a wireless microphone for any computer. You open the page on your computer, scan the QR code with your phone, and speak — the text appears on the computer. It is free to use, requires no account and no installation, and the connection is end-to-end encrypted. Speech is recognized on your phone."),
 ("Who is TebScribe built for?", "tebIQ is for clinicians — physicians, residents, advanced practice providers, and the clinics they work in. tebChart is for patients and families organizing their own records after a hospital or emergency department visit. tebDictate is for anyone, clinical or not, who would rather talk than type."),
 ("Where can I get the apps?", "tebIQ runs in a web browser at tebiq.com, on the App Store for iPhone and Apple Watch, and on Google Play for Android. tebChart is on the App Store for iPhone. tebDictate works in any phone browser at tebdictate.com with nothing to install, and is also on the App Store."),
 ("Is my data used for training or sold?", "Encrypted in transit and at rest (AES). Never used for training. Never sold."),
 ("Does tebIQ replace clinical judgment?", "tebIQ is a clinical documentation assistant for licensed healthcare professionals. It supports — and never replaces — clinical judgment. tebIQ does not diagnose, treat, or make medical decisions; the clinician is always responsible for the note."),
]
vis = '<div class="j3d-faq" aria-label="Frequently asked questions"><h2>Frequently asked</h2>' + "".join(
    "<details><summary>%s</summary><p>%s</p></details>" % (html.escape(q, quote=False), html.escape(a, quote=False)) for q, a in QA) + "</div>"
ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
    {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in QA]}
ldtag = '<script type="application/ld+json">\n' + json.dumps(ld, ensure_ascii=False, indent=1) + "\n</script>\n"
END = "types into any computer.</p></section>"
ANCHOR = '<link rel="icon"'
for f in sys.argv[1:]:
    s = open(f).read()
    assert s.count(END) == 1 and s.count(ANCHOR) == 1 and "FAQPage" not in s, f
    s = s.replace(END, "types into any computer.</p>" + vis + "</section>")
    s = s.replace(ANCHOR, ldtag + ANCHOR, 1)
    open(f, "w").write(s)
    print("ok", f)
