// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { OwnerProvider, useIsOwner } from '@/components/site-renderer/OwnerContext'

function IsOwnerDisplay() {
    const isOwner = useIsOwner()
    return <span data-testid="result">{String(isOwner)}</span>
}

describe('OwnerContext', () => {
    // TC-F09-OWN-01: defaults to false when no provider
    it('TC-F09-OWN-01: useIsOwner returns false without provider', () => {
        render(<IsOwnerDisplay />)
        expect(screen.getByTestId('result').textContent).toBe('false')
    })

    // TC-F09-OWN-02: returns true when provider value is true
    it('TC-F09-OWN-02: useIsOwner returns true when provider value=true', () => {
        render(
            <OwnerProvider value={true}>
                <IsOwnerDisplay />
            </OwnerProvider>
        )
        expect(screen.getByTestId('result').textContent).toBe('true')
    })

    // TC-F09-OWN-03: returns false when provider value is false
    it('TC-F09-OWN-03: useIsOwner returns false when provider value=false', () => {
        render(
            <OwnerProvider value={false}>
                <IsOwnerDisplay />
            </OwnerProvider>
        )
        expect(screen.getByTestId('result').textContent).toBe('false')
    })
})
