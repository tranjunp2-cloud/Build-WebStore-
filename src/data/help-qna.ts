import { BarChart3, Rocket, PenLine, Settings, type LucideIcon } from 'lucide-react';
import { Translations } from '@/i18n';

export interface QnAItem {
    id: string;
    question: string;
    answer: string;
}

export interface QnACategory {
    id: string;
    title: string;
    Icon: LucideIcon;
    items: QnAItem[];
}

export const getQnAData = (t: Translations): QnACategory[] => [
    {
        id: 'dashboard',
        title: t.help.qna.categories.dashboardTitle,
        Icon: BarChart3,
        items: [
            {
                id: 'q-dashboard-metrics',
                question: t.help.qna.categories.qDashboardMetrics,
                answer: t.help.qna.categories.aDashboardMetrics,
            },
            {
                id: 'q-dashboard-customize',
                question: t.help.qna.categories.qDashboardCustomize,
                answer: t.help.qna.categories.aDashboardCustomize,
            },
            {
                id: 'q-dashboard-seo',
                question: t.help.qna.categories.qDashboardSeo,
                answer: t.help.qna.categories.aDashboardSeo,
            }
        ]
    },
    {
        id: 'builder',
        title: t.help.qna.categories.builderTitle,
        Icon: Rocket,
        items: [
            {
                id: 'q-builder-create',
                question: t.help.qna.categories.qBuilderCreate,
                answer: t.help.qna.categories.aBuilderCreate,
            },
            {
                id: 'q-builder-edit',
                question: t.help.qna.categories.qBuilderEdit,
                answer: t.help.qna.categories.aBuilderEdit,
            },
            {
                id: 'q-builder-mobile',
                question: t.help.qna.categories.qBuilderMobile,
                answer: t.help.qna.categories.aBuilderMobile,
            }
        ]
    },
    {
        id: 'blog',
        title: t.help.qna.categories.blogTitle,
        Icon: PenLine,
        items: [
            {
                id: 'q-blog-create',
                question: t.help.qna.categories.qBlogCreate,
                answer: t.help.qna.categories.aBlogCreate,
            },
            {
                id: 'q-blog-ai',
                question: t.help.qna.categories.qBlogAi,
                answer: t.help.qna.categories.aBlogAi,
            },
            {
                id: 'q-blog-seo',
                question: t.help.qna.categories.qBlogSeo,
                answer: t.help.qna.categories.aBlogSeo,
            }
        ]
    },
    {
        id: 'settings',
        title: t.help.qna.categories.settingsTitle,
        Icon: Settings,
        items: [
            {
                id: 'q-settings-domain',
                question: t.help.qna.categories.qSettingsDomain,
                answer: t.help.qna.categories.aSettingsDomain,
            },
            {
                id: 'q-settings-dns',
                question: t.help.qna.categories.qSettingsDns,
                answer: t.help.qna.categories.aSettingsDns,
            },
            {
                id: 'q-settings-staff',
                question: t.help.qna.categories.qSettingsStaff,
                answer: t.help.qna.categories.aSettingsStaff,
            }
        ]
    }
];
