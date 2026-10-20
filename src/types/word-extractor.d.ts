declare module "word-extractor" {
  interface ExtractedDocument {
    getBody(): string;
    getHeaders(): string;
    getFooters(): string;
    getAnnotations(): string;
    getStrings(): string[];
  }
  export default class WordExtractor {
    extract(source: Buffer | string): Promise<ExtractedDocument>;
  }
}
