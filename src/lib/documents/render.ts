import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import type { DocumentModel, DocBlock } from "@domain/documents/builders";

function blockToParagraphs(block: DocBlock): Paragraph[] {
  switch (block.type) {
    case "heading":
      return [
        new Paragraph({
          heading:
            block.level === 1 ? HeadingLevel.TITLE : block.level === 2 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: block.level === 1 ? 0 : 240, after: 120 },
          children: [new TextRun({ text: block.text })],
        }),
      ];
    case "paragraph":
      return [
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: block.text,
              bold: block.bold,
              italics: block.italic,
            }),
          ],
        }),
      ];
    case "bullets":
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: item })],
          }),
      );
    case "kv":
      return [
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${block.label}: `, bold: true }),
            new TextRun({ text: block.value }),
          ],
        }),
      ];
    case "spacing":
      return [new Paragraph({ text: "", spacing: { after: 120 } })];
  }
}

/** Render a DocumentModel to a .docx Buffer via the `docx` library. */
export async function renderDocx(model: DocumentModel): Promise<Buffer> {
  const children: Paragraph[] = [];
  for (const block of model.blocks) {
    children.push(...blockToParagraphs(block));
  }
  const doc = new Document({
    creator: "RelocateOS",
    title: model.title,
    description: "Generated from verified profile facts — review before submitting.",
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 },
          },
        },
        children: children.length > 0 ? children : [new Paragraph({ text: "" })],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
