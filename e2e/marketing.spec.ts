import { expect, test } from "@playwright/test";

test.describe("ATLAS OS marketing parallax", () => {
  for (const route of [
    "/landing",
    "/for",
    "/for/operators",
    "/brand",
    "/fleet",
    "/simulator",
  ]) {
    test(`${route} renders the layered parallax visual`, async ({ page }) => {
      await page.goto(route);

      const parallax = page.getByTestId("marketing-parallax");
      await expect(parallax).toBeVisible();
      await expect(parallax.getByRole("img")).toBeVisible();

      const box = await parallax.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(280);
      expect(box?.height ?? 0).toBeGreaterThan(220);
    });
  }

  test("parallax image layers keep intentional depth styling", async ({
    page,
  }) => {
    await page.goto("/landing");

    const depth = await page.getByTestId("marketing-parallax").evaluate((el) => {
      const layer = (selector: string) => {
        const node = el.querySelector(selector);
        if (!node) throw new Error(`Missing layer: ${selector}`);
        const style = window.getComputedStyle(node);
        return {
          filter: style.filter,
          opacity: Number.parseFloat(style.opacity),
          zIndex: Number.parseInt(style.zIndex, 10),
        };
      };

      return {
        back: layer(".marketing-parallax__backdrop"),
        front: layer(".marketing-parallax__foreground"),
        mid: layer(".marketing-parallax__twin"),
      };
    });

    expect(depth.back.filter).toContain("blur");
    expect(depth.back.opacity).toBeLessThan(depth.front.opacity);
    expect(depth.back.zIndex).toBeLessThan(depth.mid.zIndex);
    expect(depth.front.zIndex).toBeGreaterThan(depth.mid.zIndex);
  });

  test("overview page renders the drone demo video with its poster", async ({
    page,
  }) => {
    await page.goto("/landing");

    const video = page.getByTestId("landing-demo-video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute(
      "poster",
      "/marketing/atlas-drone-demo-poster.jpg",
    );
    await expect(video.locator("source")).toHaveAttribute(
      "src",
      "/marketing/atlas-drone-demo.mp4",
    );
    await expect(video).toHaveAttribute("preload", "none");

    const media = await video.evaluate((el) => {
      const videoEl = el as HTMLVideoElement;
      const box = videoEl.getBoundingClientRect();

      return {
        controls: videoEl.controls,
        width: box.width,
        height: box.height,
      };
    });

    expect(media.controls).toBe(true);
    expect(media.width).toBeGreaterThan(280);
    expect(media.height).toBeGreaterThan(200);
  });

  for (const { route, image } of [
    { route: "/landing", image: "atlas" },
    { route: "/for", image: "solutions" },
    { route: "/for/operators", image: "solutions" },
    { route: "/brand", image: "brand" },
    { route: "/fleet", image: "fleet" },
    { route: "/simulator", image: "simulator" },
  ]) {
    test(`${route} uses its page-specific parallax imagery`, async ({
      page,
    }) => {
      await page.goto(route);

      const srcs = await page.getByTestId("marketing-parallax").evaluate((el) =>
        Array.from(el.querySelectorAll("img")).map((img) =>
          img.getAttribute("src"),
        ),
      );

      expect(srcs).toEqual(
        expect.arrayContaining([
          `/marketing/${image}-parallax-backdrop.jpg`,
          `/marketing/${image}-parallax-twin.jpg`,
          `/marketing/${image}-parallax-foreground.jpg`,
        ]),
      );
    });
  }
});
