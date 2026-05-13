class AngleParser {
  private index = 0;

  constructor(private readonly input: string) {}

  parse(): number {
    const value = this.parseExpression();
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      throw new Error(`Unsupported rotation angle: ${this.input}`);
    }
    if (!Number.isFinite(value)) {
      throw new Error(`Rotation angle must be finite: ${this.input}`);
    }
    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (true) {
      this.skipWhitespace();
      if (this.match("+")) {
        value += this.parseTerm();
      } else if (this.match("-")) {
        value -= this.parseTerm();
      } else {
        return value;
      }
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (true) {
      this.skipWhitespace();
      if (this.match("*")) {
        value *= this.parseFactor();
      } else if (this.match("/")) {
        value /= this.parseFactor();
      } else {
        return value;
      }
    }
  }

  private parseFactor(): number {
    this.skipWhitespace();
    if (this.match("+")) {
      return this.parseFactor();
    }
    if (this.match("-")) {
      return -this.parseFactor();
    }
    if (this.match("(")) {
      const value = this.parseExpression();
      this.skipWhitespace();
      if (!this.match(")")) {
        throw new Error(`Could not parse rotation angle: ${this.input}`);
      }
      return value;
    }
    if (this.peekWord("pi")) {
      this.index += 2;
      return Math.PI;
    }
    return this.parseNumber();
  }

  private parseNumber(): number {
    this.skipWhitespace();
    const start = this.index;
    while (/[0-9.]/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }
    if (start === this.index) {
      throw new Error(`Could not parse rotation angle: ${this.input}`);
    }
    const raw = this.input.slice(start, this.index);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
      throw new Error(`Could not parse rotation angle: ${this.input}`);
    }
    return Number(raw);
  }

  private skipWhitespace() {
    while (/\s/.test(this.input[this.index] ?? "")) {
      this.index += 1;
    }
  }

  private match(char: string): boolean {
    if (this.input[this.index] === char) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private peekWord(word: string): boolean {
    return this.input.slice(this.index, this.index + word.length).toLowerCase() === word;
  }
}

export function parseAngleExpression(rawText: string): number {
  const expression = rawText.trim();
  if (!/^[0-9piPI+\-*/().\s]+$/.test(expression)) {
    throw new Error(`Unsupported rotation angle: ${rawText}`);
  }
  return new AngleParser(expression).parse();
}
