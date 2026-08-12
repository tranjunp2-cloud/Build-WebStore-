/**
 * @fileoverview GH-1757 coordinate input regressions.
 * TC-ID: TC-F37-10-02
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('sonner', () => ({
    toast: { error: vi.fn() },
}))

import { GeoLinkInput } from '@/components/editor/local-business/geo-link-input'

const LABELS = {
    pasteMapsLink: 'Google Maps link',
    mapsLinkPlaceholder: 'Paste a Google Maps URL',
    pasteMapsLinkHint: 'Paste a link to extract coordinates.',
    extractCoordinates: 'Extract',
    extracting: 'Extracting',
    coordinatesExtracted: 'Coordinates extracted',
    latitude: 'Latitude',
    longitude: 'Longitude',
    manualCoordinates: 'Enter coordinates manually (advanced)',
    manualCoordinatesHint: 'Use decimal coordinates.',
    invalidLatitude: 'Latitude must be between -90 and 90.',
    invalidLongitude: 'Longitude must be between -180 and 180.',
    geoExtractFailed: 'Could not extract coordinates.',
}

function renderManualInputs(
    onCoordinatesChange = vi.fn(),
    initialCoordinates: { latitude?: number; longitude?: number } = {},
) {
    render(
        <GeoLinkInput
            {...initialCoordinates}
            onCoordinatesChange={onCoordinatesChange}
            labels={LABELS}
        />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Enter coordinates manually/i }))
    const inputs = screen.getAllByRole('spinbutton')
    return {
        latitude: inputs[0] as HTMLInputElement,
        longitude: inputs[1] as HTMLInputElement,
        onCoordinatesChange,
    }
}

describe('[TC-F37-10-02] GeoLinkInput manual coordinate validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('exposes exact native bounds, decimal input semantics, and label associations', () => {
        // Arrange
        const { latitude, longitude } = renderManualInputs()

        // Act — inspect the rendered native controls

        // Assert
        expect(latitude).toHaveAttribute('type', 'number')
        expect(latitude).toHaveAttribute('inputmode', 'decimal')
        expect(latitude).toHaveAttribute('step', 'any')
        expect(latitude).toHaveAttribute('min', '-90')
        expect(latitude).toHaveAttribute('max', '90')
        expect(longitude).toHaveAttribute('type', 'number')
        expect(longitude).toHaveAttribute('inputmode', 'decimal')
        expect(longitude).toHaveAttribute('step', 'any')
        expect(longitude).toHaveAttribute('min', '-180')
        expect(longitude).toHaveAttribute('max', '180')
        expect(screen.getByLabelText('Latitude')).toBe(latitude)
        expect(screen.getByLabelText('Longitude')).toBe(longitude)
    })

    it('cancels unmodified letters/plus keys but preserves modifier shortcuts', () => {
        // Arrange
        const { latitude } = renderManualInputs()

        // Act
        const forbiddenResults = ['e', 'E', '+', 'a'].map(key => fireEvent.keyDown(latitude, { key }))
        const shortcutResults = [
            fireEvent.keyDown(latitude, { key: '+', ctrlKey: true }),
            fireEvent.keyDown(latitude, { key: '+', metaKey: true }),
            fireEvent.keyDown(latitude, { key: '+', altKey: true }),
        ]

        // Assert
        expect(forbiddenResults).toEqual([false, false, false, false])
        expect(shortcutResults).toEqual([true, true, true])
    })

    it('cancels non-coordinate paste payloads without canceling valid decimal or negative paste', () => {
        // Arrange
        const { longitude } = renderManualInputs()
        const paste = (value: string) => fireEvent.paste(longitude, {
            clipboardData: { getData: () => value },
        })

        // Act
        const forbiddenResults = ['1e2', '1E2', '+101.6955', 'abc'].map(paste)
        const allowedResults = ['3.1469', '-101.6955'].map(paste)

        // Assert
        expect(forbiddenResults).toEqual([false, false, false, false])
        expect(allowedResults).toEqual([true, true])
    })

    it('clears unsupported text inserted without keydown or paste', () => {
        // Arrange
        const onCoordinatesChange = vi.fn()
        const { latitude } = renderManualInputs(onCoordinatesChange)

        // Act — model insertText/composition paths that bypass keydown and paste.
        fireEvent.input(latitude, {
            target: { value: '1e2' },
            data: '1e2',
            inputType: 'insertText',
        })

        // Assert
        expect(latitude).toHaveValue(null)
        expect(onCoordinatesChange).not.toHaveBeenCalled()
    })

    it('restores the prior valid value after a non-cancelable invalid input', () => {
        // Arrange
        const onCoordinatesChange = vi.fn()
        const { latitude } = renderManualInputs(onCoordinatesChange)
        fireEvent.input(latitude, {
            target: { value: '12' },
            data: '12',
            inputType: 'insertText',
        })

        // Act — model an IME/composition input whose beforeinput was not cancelable.
        fireEvent.input(latitude, {
            target: { value: '12e' },
            data: 'e',
            inputType: 'insertCompositionText',
        })

        // Assert
        expect(latitude).toHaveValue(12)
        expect(onCoordinatesChange).not.toHaveBeenCalled()
    })

    it('preserves a server-provided initial value on the first non-cancelable IME input', () => {
        // Arrange — no earlier input/beforeinput event has seeded the fallback snapshot.
        const onCoordinatesChange = vi.fn()
        const { latitude } = renderManualInputs(onCoordinatesChange, { latitude: 12 })
        fireEvent.focus(latitude)

        // Act — model the first interaction as a non-cancelable composition event.
        fireEvent.input(latitude, {
            target: { value: '12e' },
            data: 'e',
            inputType: 'insertCompositionText',
        })

        // Assert
        expect(latitude).toHaveValue(12)
        expect(onCoordinatesChange).not.toHaveBeenCalled()
    })

    it('preserves valid negative decimal input', () => {
        // Arrange
        const { longitude } = renderManualInputs()
        const raw = '-101.6955'

        // Act
        fireEvent.input(longitude, {
            target: { value: raw },
            data: raw,
            inputType: 'insertText',
        })

        // Assert
        expect(longitude.value).toBe(raw)
    })

    it.each([
        ['latitude', 0, '-90', { latitude: -90 }],
        ['latitude', 0, '90', { latitude: 90 }],
        ['longitude', 1, '-180', { longitude: -180 }],
        ['longitude', 1, '180', { longitude: 180 }],
        ['longitude', 1, '-101.6955', { longitude: -101.6955 }],
    ] as const)('accepts valid %s value %s', (_field, inputIndex, raw, expectedPatch) => {
        // Arrange
        const onCoordinatesChange = vi.fn()
        const { latitude, longitude } = renderManualInputs(onCoordinatesChange)
        const input = [latitude, longitude][inputIndex]

        // Act
        fireEvent.blur(input, { target: { value: raw } })

        // Assert
        expect(onCoordinatesChange).toHaveBeenCalledTimes(1)
        expect(onCoordinatesChange).toHaveBeenCalledWith(expectedPatch)
    })

    it.each([
        ['Latitude', 0, '91', LABELS.invalidLatitude],
        ['Longitude', 1, '-181', LABELS.invalidLongitude],
    ] as const)('rejects invalid %s blur, exposes the error, and sends no save callback', (
        _field,
        inputIndex,
        raw,
        expectedError,
    ) => {
        // Arrange
        const onCoordinatesChange = vi.fn()
        const { latitude, longitude } = renderManualInputs(onCoordinatesChange)
        const input = [latitude, longitude][inputIndex]

        // Act
        fireEvent.blur(input, { target: { value: raw } })

        // Assert
        const error = screen.getByText(expectedError)
        expect(onCoordinatesChange).not.toHaveBeenCalled()
        expect(error).toBeVisible()
        expect(input).toHaveAttribute('aria-invalid', 'true')
        expect(input).toHaveAttribute('aria-describedby', error.id)
    })

    it('reports native badInput on blur instead of treating it as an empty coordinate', () => {
        // Arrange
        const onCoordinatesChange = vi.fn()
        const { latitude } = renderManualInputs(onCoordinatesChange)
        Object.defineProperty(latitude, 'validity', {
            configurable: true,
            value: { badInput: true },
        })

        // Act — number inputs expose malformed syntax as value="" + badInput.
        fireEvent.blur(latitude, { target: { value: '' } })

        // Assert
        const error = screen.getByText(LABELS.invalidLatitude)
        expect(onCoordinatesChange).not.toHaveBeenCalled()
        expect(error).toBeVisible()
        expect(latitude).toHaveAttribute('aria-invalid', 'true')
        expect(latitude).toHaveAttribute('aria-describedby', error.id)
    })
})
