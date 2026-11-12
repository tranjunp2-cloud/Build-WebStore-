// @vitest-environment jsdom
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '@/i18n';
import en from '@/i18n/locales/en.json';
import { QnAAccordion } from '@/components/help/QnAAccordion';
import { QNA_VIDEOS, formatVideoDuration } from '@/components/help/qna-video-media';
import { getQnAData } from '@/data/help-qna';
import { QnAPageClient } from '@/app/(dashboard)/help/qna/QnAPageClient';

const DNS = QNA_VIDEOS['q-settings-dns'];

const renderItem = (props: Partial<React.ComponentProps<typeof QnAAccordion>> = {}, locale: 'en' | 'ms' = 'en') =>
    render(
        <I18nProvider defaultLocale={locale}>
            <QnAAccordion question="How do I set up DNS records?" answer="Add the <strong>A</strong> record." isOpen onToggle={() => {}} {...props} />
        </I18nProvider>,
    );

describe('[US-F20-02] Q&A tutorial videos (#2464)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('TC-F20-02-13: open question with a video shows it under the answer — poster, native controls, no autoplay, lazy', () => {
        // Arrange + Act
        const { container } = renderItem({ video: DNS, videoBadgeLabel: 'Has a video guide' });

        // Assert
        const video = container.querySelector('video') as HTMLVideoElement;
        expect(video).toBeInTheDocument();
        expect(video).toHaveAttribute('src', DNS.src);
        expect(video).toHaveAttribute('poster', DNS.poster);
        expect(video).toHaveAttribute('preload', 'none');
        expect(video).toHaveAttribute('controls');
        expect(video).not.toHaveAttribute('autoplay');
        expect(screen.getByText('Video guide')).toBeInTheDocument();
        expect(screen.getByText(`· ${formatVideoDuration(DNS.duration)}`)).toBeInTheDocument();
        // Video comes after the answer text in the panel
        const answer = screen.getByText('A').closest('div') as HTMLElement;
        expect(answer.compareDocumentPosition(screen.getByTestId('qna-video')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('TC-F20-02-14: a question without a video renders as before — no video frame, no ▶ marker', () => {
        // Arrange + Act
        const { container } = renderItem();

        // Assert
        expect(container.querySelector('video')).toBeNull();
        expect(screen.queryByTestId('qna-video')).toBeNull();
        expect(screen.queryByTestId('qna-video-badge')).toBeNull();
    });

    it('TC-F20-02-15: a closed question shows the ▶ marker but mounts no <video> (nothing to download)', () => {
        // Arrange + Act
        const { container } = renderItem({ isOpen: false, video: DNS, videoBadgeLabel: 'Has a video guide' });

        // Assert
        expect(container.querySelector('video')).toBeNull();
        expect(screen.getByRole('img', { name: `Has a video guide · ${formatVideoDuration(DNS.duration)}` })).toBeInTheDocument();
    });

    it('TC-F20-02-18: labels follow the locale (MS)', () => {
        // Arrange + Act
        const { container } = renderItem({ video: DNS }, 'ms');

        // Assert
        expect(screen.getByText('Panduan video')).toBeInTheDocument();
        expect(container.querySelector('video')).toHaveAttribute('aria-label', 'Panduan video: How do I set up DNS records?');
    });

    it('TC-F20-02-19: searching for a question with a video still shows the question, and opening it shows the video', () => {
        // Arrange
        vi.useFakeTimers();
        const { container } = render(<I18nProvider defaultLocale="en"><QnAPageClient /></I18nProvider>);

        // Act
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'DNS records' } });
        act(() => { vi.advanceTimersByTime(300); });
        fireEvent.click(screen.getByText('How do I set up DNS records?'));

        // Assert
        expect(screen.getByRole('img', { name: `Has a video guide · ${formatVideoDuration(DNS.duration)}` })).toBeInTheDocument();
        expect(container.querySelector('video')).toHaveAttribute('src', DNS.src);
        vi.useRealTimers();
    });

    it('TC-F20-02-19: every video maps to an existing Q&A item', () => {
        // Arrange + Act
        const ids = getQnAData(en as never).flatMap(c => c.items).map(i => i.id);

        // Assert
        for (const id of Object.keys(QNA_VIDEOS)) expect(ids).toContain(id);
    });

    it('TC-F20-02-21: a video file that never loads removes the frame and the ▶ marker, and keeps the answer text', () => {
        // Arrange
        const { container } = renderItem({ video: DNS, videoBadgeLabel: 'Has a video guide' });

        // Act — readyState is HAVE_NOTHING: nothing was ever loaded
        fireEvent.error(container.querySelector('video') as HTMLVideoElement);

        // Assert
        expect(container.querySelector('video')).toBeNull();
        expect(screen.queryByTestId('qna-video-badge')).toBeNull();
        expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('TC-F20-02-21: a network drop after playback started keeps the player (viewer keeps their position)', () => {
        // Arrange
        const { container } = renderItem({ video: DNS });
        const video = container.querySelector('video') as HTMLVideoElement;
        Object.defineProperty(video, 'readyState', { value: HTMLMediaElement.HAVE_CURRENT_DATA, configurable: true });

        // Act
        fireEvent.error(video);

        // Assert
        expect(container.querySelector('video')).toBe(video);
    });

    it('TC-F20-02-22: starting a second video pauses the one already playing', () => {
        // Arrange
        const { container } = render(
            <I18nProvider defaultLocale="en">
                <QnAAccordion question="Q1" answer="a1" isOpen onToggle={() => {}} video={QNA_VIDEOS['q-settings-domain']} />
                <QnAAccordion question="Q2" answer="a2" isOpen onToggle={() => {}} video={DNS} />
            </I18nProvider>,
        );
        const [first, second] = Array.from(container.querySelectorAll('video'));
        const pause = HTMLMediaElement.prototype.pause as unknown as ReturnType<typeof vi.fn>;

        // Act
        fireEvent.play(first);
        fireEvent.play(second);

        // Assert
        expect(pause).toHaveBeenCalledTimes(1);
        expect(pause.mock.instances[0]).toBe(first);
    });

    it('TC-F20-02-13: every video and poster file is shipped in /public', () => {
        // Arrange
        const pub = path.join(process.cwd(), 'public');

        // Act + Assert
        for (const m of Object.values(QNA_VIDEOS)) {
            expect(fs.existsSync(path.join(pub, m.src))).toBe(true);
            expect(fs.existsSync(path.join(pub, m.poster))).toBe(true);
        }
        expect(formatVideoDuration(102)).toBe('1:42');
        expect(formatVideoDuration(47)).toBe('0:47');
    });
});
