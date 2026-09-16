import {test,expect} from '@playwright/test'

test('[TC-F35.M43] migrated portfolio without groups hides category controls', async ({page}) => {
    await page.goto('http://localhost:3000/sites/amelina')
    const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Your interest 1234',exact:true})}).last()
    await expect(section).toBeVisible()
    await expect(section.locator('img').first()).toBeVisible()
    await expect(section.getByRole('group',{name:'Filter projects by category'})).toHaveCount(0)
    await expect(section.getByRole('button',{name:'All',exact:true})).toHaveCount(0)
})
