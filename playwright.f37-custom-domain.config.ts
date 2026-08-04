import { defineConfig, devices } from '@playwright/test'
import playwrightConfig, { F37_CUSTOM_DOMAIN_TEST } from './playwright.config'

const setupProject = playwrightConfig.projects?.find(project => project.name === 'setup')

if (!setupProject) {
    throw new Error('The F37 custom-domain config requires the shared setup project')
}

export default defineConfig({
    ...playwrightConfig,
    // TC-52 requires an account-owned active public custom domain with
    // advertised product/blog details. Keeping it in a separate config makes
    // the pending live check opt-in for CLI and IDE runs as well as staging CI.
    projects: [
        setupProject,
        {
            name: 'f37-custom-domain-manual',
            testDir: './tests',
            testMatch: /f37-ai-discoverability\.spec\.ts/,
            grep: F37_CUSTOM_DOMAIN_TEST,
            use: {
                ...devices['Desktop Chrome'],
                storageState: undefined,
            },
            dependencies: ['setup'],
        },
    ],
})
