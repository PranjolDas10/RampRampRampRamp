import { describe, expect, it } from "vitest";
import { LIBRARY, PEOPLE } from "./library";

describe("personal workflow scripts", () => {
  for (const w of LIBRARY) {
    for (const person of PEOPLE) {
      const author = PEOPLE.find((p) => p.id === w.author)!;

      it(`${w.id} mac script for ${person.id} is a zsh script that opens VS Code`, () => {
        const body = w.script(person, author);
        expect(body.startsWith("#!/bin/zsh")).toBe(true);
        expect(body).toContain('open -a "Visual Studio Code"');
        expect(body).toContain(person.values.repo);
      });

      it(`${w.id} windows script for ${person.id} uses backslashes and opens code`, () => {
        const body = w.winScript(person, author);
        expect(body.startsWith("@echo off")).toBe(true);
        expect(body).toContain("start \"\" code");
        expect(body).toContain("%USERPROFILE%\\");
        expect(body).toContain(person.values.repo.replace(/\//g, "\\"));
        // User values must not leave bare & or " that would break cmd parsing mid-token.
        const setLines = body.split(/\r?\n/).filter((l) => /^set "/i.test(l));
        for (const line of setLines) {
          expect(line.includes('&') && !line.includes("^&") ? line.match(/[^"]&[^"]/) : null).toBeNull();
        }
      });
    }
  }

  it("start-workday windows script opens the localhost URL", () => {
    const w = LIBRARY.find((x) => x.id === "start-workday")!;
    const you = PEOPLE.find((p) => p.id === "you")!;
    const body = w.winScript(you, you);
    expect(body).toContain(`http://localhost:${you.values.port}`);
    expect(body).toContain("curl -s -o nul");
  });
});
