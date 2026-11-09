import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { animationsDone, loginUi, tempGroup, uniq } from './helpers';

const axe = async (page: Page) => {
  await animationsDone(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
};

for (const colorScheme of ['light', 'dark'] as const) {
  test(`рисовалка: ученик рисует на телефоне и сдаёт рисунок работой (${colorScheme})`, async ({ page, request }) => {
    const g = await tempGroup(request, uniq('E2E рисовалка'), ['Лиза Ершова']);
    try {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 375, height: 812 });
      await loginUi(page, g.credentials[0].login, g.credentials[0].password);
      await page.getByRole('link', { name: 'Мои работы' }).click();
      await page.getByRole('button', { name: 'Нарисовать' }).click();
      const dialog = page.getByRole('dialog', { name: 'Рисунок' });
      await dialog.getByRole('button', { name: 'Красный' }).click();
      await dialog.getByRole('button', { name: 'Толстая' }).click();

      // Горизонтальная линия через середину листа
      const sheet = dialog.getByRole('img', { name: /Лист для рисования/ });
      const box = (await sheet.boundingBox())!;
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width * 0.2, y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.8, y, { steps: 12 });
      await page.mouse.up();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      await page.screenshot({ path: test.info().outputPath(`drawing-${colorScheme}.png`) });
      await axe(page);
      await dialog.getByRole('button', { name: 'Готово: приложить к работе' }).click();

      await expect(page.getByRole('list', { name: 'Выбранные файлы' })).toContainText('рисунок.png');
      await expect(page.getByLabel('Название')).toHaveValue('Рисунок');
      await page.getByRole('button', { name: 'Отправить преподавателю' }).click();
      await expect(page.getByRole('list', { name: 'Мои работы' }).getByText('На проверке')).toBeVisible();

      // Сохранённый файл — PNG листа 1200×900: посередине красная линия, в углу белая бумага
      const [work] = await (await page.request.get('/api/student/works')).json();
      expect(work.files).toMatchObject([{ name: 'рисунок.png', mime: 'image/png' }]);
      const pixels = await page.evaluate(async (id) => {
        const image = new Image();
        image.src = `/api/files/${id}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
        return { size: [image.naturalWidth, image.naturalHeight], middle: at(600, 450), corner: at(20, 20) };
      }, work.files[0].id);
      expect(pixels.size).toEqual([1200, 900]);
      expect(pixels.corner).toEqual([255, 255, 255, 255]);
      expect(pixels.middle[0]).toBeGreaterThan(200);
      expect(pixels.middle[1]).toBeLessThan(80);
    } finally {
      await g.remove();
    }
  });
}
