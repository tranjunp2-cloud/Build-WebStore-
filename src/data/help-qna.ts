import { Translations } from '@/i18n';

export interface QnAItem {
    id: string;
    question: string;
    answer: string;
}

export interface QnACategory {
    id: string;
    title: string;
    items: QnAItem[];
}

export const getQnAData = (t: Translations): QnACategory[] => [
    {
        id: 'products',
        title: t.help.qna.categories.productsTitle,
        items: [
            {
                id: 'q-add-product',
                question: t.help.qna.categories.qAddProduct,
                answer: t.help.qna.categories.aAddProduct,
            },
            {
                id: 'q-multiple-images',
                question: t.help.qna.categories.qMultipleImages,
                answer: t.help.qna.categories.aMultipleImages,
            },
            {
                id: 'q-halal',
                question: t.help.qna.categories.qHalal,
                answer: t.help.qna.categories.aHalal,
            }
        ]
    },
    {
        id: 'orders',
        title: t.help.qna.categories.ordersTitle,
        items: [
            {
                id: 'q-cod',
                question: t.help.qna.categories.qCod,
                answer: t.help.qna.categories.aCod,
            },
            {
                id: 'q-invoice',
                question: t.help.qna.categories.qInvoice,
                answer: t.help.qna.categories.aInvoice,
            }
        ]
    },
    {
        id: 'payments',
        title: t.help.qna.categories.paymentsTitle,
        items: [
            {
                id: 'q-fpx',
                question: t.help.qna.categories.qFpx,
                answer: t.help.qna.categories.aFpx,
            },
            {
                id: 'q-sst',
                question: t.help.qna.categories.qSst,
                answer: t.help.qna.categories.aSst,
            }
        ]
    }
];
