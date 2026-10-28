/** The words the editor's chat uses around Undo and Auto-approve (en · ms · vi, like the chat's other editor phrases). */
export type EditorUndoPhrases = {
    /** Approve pressed while a canvas text edit is still open */
    finishEditing: string
    /** Auto-approve is holding a change back until the merchant stops editing */
    waitingToApply: string
    /** a newer change on the same part has to be undone first ({title}) */
    newerFirst: string
    /** the card's Undo is the header's Undo (this change is the newest step) */
    sameAsHeader: string
    /** newer steps in the timeline sit on top of this change */
    newerStepsFirst: string
    /** Undo above already took this change back */
    undoneHere: string
    /** after a reload the timeline is gone: the card restores the saved version instead */
    restore: string
    restoreNote: string
    /** the page changed since, so neither Undo nor Restore can put it back */
    editedSince: string
    /** a setting the timeline does not cover (page SEO, new pages, languages, publishing) */
    cardOnly: string
    /** the step could not be saved, so nothing was undone for good */
    couldNotSave: string
}

const PHRASES: Record<string, EditorUndoPhrases> = {
    en: {
        finishEditing: 'Finish your edit first (click outside the text), then approve.',
        waitingToApply: 'Waiting until you finish editing…',
        newerFirst: 'Undo “{title}” first — it changed the same part later.',
        sameAsHeader: 'Same as Undo at the top (Ctrl/Cmd+Z)',
        newerStepsFirst: 'Newer changes first — use Undo at the top',
        undoneHere: 'Undone here — Redo at the top brings it back',
        restore: 'Restore previous version',
        restoreNote: 'The Undo history ended when the page was reloaded. This puts the saved version back.',
        editedSince: 'The page was edited since — change it back in the editor',
        cardOnly: 'Setting change — undo it here',
        couldNotSave: 'The change could not be saved, so it was not undone. Try again.',
    },
    ms: {
        finishEditing: 'Selesaikan suntingan anda dahulu (klik di luar teks), kemudian luluskan.',
        waitingToApply: 'Menunggu sehingga anda selesai menyunting…',
        newerFirst: 'Buat asal “{title}” dahulu — ia mengubah bahagian yang sama kemudian.',
        sameAsHeader: 'Sama seperti Buat asal di atas (Ctrl/Cmd+Z)',
        newerStepsFirst: 'Perubahan terbaharu dahulu — guna Buat asal di atas',
        undoneHere: 'Sudah dibuat asal — Buat semula di atas mengembalikannya',
        restore: 'Pulihkan versi sebelumnya',
        restoreNote: 'Sejarah Buat asal tamat apabila halaman dimuat semula. Ini memulihkan versi yang disimpan.',
        editedSince: 'Halaman telah disunting sejak itu — ubah semula dalam editor',
        cardOnly: 'Perubahan tetapan — buat asal di sini',
        couldNotSave: 'Perubahan tidak dapat disimpan, jadi ia tidak dibuat asal. Cuba lagi.',
    },
    vi: {
        finishEditing: 'Hãy hoàn tất chỉnh sửa trước (bấm ra ngoài đoạn văn), rồi duyệt.',
        waitingToApply: 'Đang chờ bạn chỉnh sửa xong…',
        newerFirst: 'Hãy hoàn tác “{title}” trước — nó đã đổi cùng phần này sau đó.',
        sameAsHeader: 'Giống nút Hoàn tác ở trên (Ctrl/Cmd+Z)',
        newerStepsFirst: 'Thay đổi mới hơn trước — dùng Hoàn tác ở trên',
        undoneHere: 'Đã hoàn tác — Làm lại ở trên sẽ đưa nó trở lại',
        restore: 'Khôi phục phiên bản trước',
        restoreNote: 'Lịch sử hoàn tác đã hết khi tải lại trang. Thao tác này đặt lại phiên bản đã lưu.',
        editedSince: 'Trang đã được sửa sau đó — hãy đổi lại trong trình chỉnh sửa',
        cardOnly: 'Thay đổi cài đặt — hoàn tác tại đây',
        couldNotSave: 'Không lưu được thay đổi nên chưa hoàn tác. Hãy thử lại.',
    },
}

export function editorUndoPhrases(locale: string): EditorUndoPhrases {
    return PHRASES[locale.slice(0, 2)] ?? PHRASES.en!
}
