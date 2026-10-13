const H = require(require("os").homedir() + "/.claude/skills/webority/scripts/helpers.js");
const { Paragraph, TextRun, AlignmentType, C } = H;

/**
 * Numbered steps with literal numbers.
 *
 * H.numbered() puts every numbered item in the document on one shared numbering
 * instance, so the second list in the document continues from where the first
 * left off - the fee steps in section 3.5 ran 1-4, and the access checks in
 * section 4.1 then rendered as 5, 6, 7. Writing the number as text sidesteps the
 * shared counter entirely while keeping the same hanging-indent look.
 */
function step(items) {
  return items.map((text, i) =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 100, line: 360, lineRule: "auto" },
      indent: { left: 720, hanging: 360 },
      children: [
        new TextRun({ text: `${i + 1}.\t`, font: "Josefin Sans", size: 22, color: C.text }),
        new TextRun({ text, font: "Josefin Sans", size: 22, color: C.text }),
      ],
    })
  );
}

module.exports = { step };
