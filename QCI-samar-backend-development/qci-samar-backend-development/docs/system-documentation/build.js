const fs = require("fs");
const os = require("os");
const path = require("path");
const H = require(os.homedir() + "/.claude/skills/webority/scripts/helpers.js");
const { Document, Packer, Paragraph, PageBreak } = H;

const SECTIONS = [
  "01-intro",
  "02-overview",
  "03-functional",
  "04-roles",
  "05-technical",
  "06-data",
  "07-security",
  "08-api",
  "09-integrations",
  "10-glossary",
  "11-appendices",
];

const { AlignmentType, TextRun } = H;

// The skill's coverPage() opens with a fixed 5200-twip spacer sized for a
// single-line title. "Quality Council of India: SAMAR Certification Portal"
// wraps to two lines at 32pt, which pushes the cover into the template's footer
// band and clips the contact line. Same four centred lines, smaller lead-in.
function coverPage({ type, client, name, date, lead = 4100 }) {
  const centred = (children, after) =>
    new H.Paragraph({ alignment: AlignmentType.CENTER, spacing: { after, line: 360, lineRule: "auto" }, children });
  return [
    H.sp(lead),
    centred([new TextRun({ text: type, font: "Josefin Sans", size: 40, color: H.C.text })], 200),
    centred([new TextRun({ text: "for", font: "Josefin Sans", size: 28, color: H.C.text })], 200),
    centred([new TextRun({ text: `${client}: ${name}`, font: "Times New Roman", size: 64, bold: true, italics: true, color: H.C.text })], 160),
    centred(H.coverDateRuns(date), 0),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

const children = [
  ...coverPage({
    type: "Technical System Documentation",
    client: "Quality Council of India",
    name: "SAMAR Certification Portal",
    date: "22nd July 2026",
  }),

  H.h1("Document control"),
  H.documentControl([
    ["1.0", "22-Jul-2026", "Webority Technologies", "Webority Technologies", "Webority Technologies", "Initial version."],
  ]),

  new Paragraph({ children: [new PageBreak()] }),
  H.h1("Contents"),
  new H.docx.TableOfContents("Contents", {
    hyperlink: true,
    headingStyleRange: "1-2",
  }),
];

for (const name of SECTIONS) {
  const file = path.join(__dirname, "src", name + ".js");
  if (!fs.existsSync(file)) continue;
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(...require(file)());
}

const doc = new Document({
  creator: "Webority Technologies",
  title: "QCI SAMAR - Technical System Documentation",
  description: "Technical system documentation for the SAMAR Certification Portal",
  styles: H.documentStyles,
  numbering: H.numberingConfig,
  sections: [{ properties: H.standardSectionProperties, children }],
});

Packer.toBuffer(doc).then((buf) => {
  const BUILD_DIR = process.env.DOCX_BUILD_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "webority_docx_build."));
  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(path.join(BUILD_DIR, "body_only.docx"), buf);
  console.log("body_only.docx written to", BUILD_DIR);
});
