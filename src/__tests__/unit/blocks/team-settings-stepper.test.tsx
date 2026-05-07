import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import TeamSettings from '@/components/editor/TeamSettings'
import type { TeamConfig, TeamMember } from '@/blocks/team/config'

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      editor: {
        settings: {
          teamConfiguration: 'Team Configuration',
          numberOfMembers: 'Number of Members',
          membersMinMax: '(Min: 1 - Max: 6)',
          memberLabel: 'Member',
          memberNamePlaceholder: 'Member name',
          memberRolePlaceholder: 'Role / title',
          memberBioPlaceholder: 'Short bio',
        },
      },
    },
  }),
}))

vi.mock('@/components/editor/BlockImageEditor', () => ({
  BlockImageEditor: ({ onImageChange }: { onImageChange: (url: string) => void }) => (
    <button onClick={() => onImageChange('mock-image-url.jpg')} type="button">
      Mock Upload
    </button>
  ),
}))

function makeBlock(overrides: Partial<TeamConfig> = {}): TeamConfig {
  return {
    blockType: 'team',
    variant: 'grid',
    headline: 'Our Team',
    members: [
      { name: 'Member 1', role: 'CEO', bio: 'Bio 1' },
      { name: 'Member 2', role: 'CTO', bio: 'Bio 2' },
      { name: 'Member 3', role: 'Designer', bio: 'Bio 3' },
    ],
    ...overrides,
  }
}

function renderPanel(block: TeamConfig, onBlockUpdate: ReturnType<typeof vi.fn>, idx = 0) {
  return render(
    <TeamSettings block={block} blockIndex={idx} onBlockUpdate={onBlockUpdate} />,
  )
}

describe('TeamSettings — stepper boundaries', () => {
  // TC-F05-894-01
  it('renders count at 1 member with − button disabled and + button enabled', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: [{ name: 'Solo Member', role: 'Solo', bio: '' }] }), onBlockUpdate)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease team member count')).toBeDisabled()
    expect(screen.getByLabelText('Increase team member count')).not.toBeDisabled()
  })

  // TC-F05-894-02
  it('renders count at 6 members with − button enabled and + button disabled', () => {
    const onBlockUpdate = vi.fn()
    const sixMembers = Array(6).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' }))
    renderPanel(makeBlock({ members: sixMembers }), onBlockUpdate)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease team member count')).not.toBeDisabled()
    expect(screen.getByLabelText('Increase team member count')).toBeDisabled()
  })

  // TC-F05-894-03
  it('renders count at 3 members (mid-range) with both buttons enabled', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: Array(3).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' })) }), onBlockUpdate)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByLabelText('Decrease team member count')).not.toBeDisabled()
    expect(screen.getByLabelText('Increase team member count')).not.toBeDisabled()
  })
})

describe('TeamSettings — CRUD operations', () => {
  // TC-F05-894-04
  it('clicking + appends new placeholder member', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: Array(3).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' })) }), onBlockUpdate)
    fireEvent.click(screen.getByLabelText('Increase team member count'))
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      members: expect.arrayContaining([{ name: 'Team Member 4', role: 'Role', bio: '' }]),
    }))
  })

  // TC-F05-894-05
  it('clicking − removes last member', () => {
    const onBlockUpdate = vi.fn()
    const members = Array(4).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' }))
    renderPanel(makeBlock({ members }), onBlockUpdate)
    fireEvent.click(screen.getByLabelText('Decrease team member count'))
    const callArgs = onBlockUpdate.mock.calls[0][1]
    expect(callArgs.members).toHaveLength(3)
    expect(callArgs.members.map((m: TeamMember) => m.name)).not.toContain('Member 4')
    expect(callArgs.members[0]).toEqual({ name: 'Member 1', role: 'Role', bio: '' })
  })

  // TC-F05-894-06
  it('clicking ✕ on mid-list member removes it and preserves neighbors', () => {
    const onBlockUpdate = vi.fn()
    const members = Array(4).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' }))
    renderPanel(makeBlock({ members }), onBlockUpdate)
    const removeButtons = screen.getAllByRole('button', { name: /Remove member/i })
    fireEvent.click(removeButtons[1]) // remove index 1 (Member 2)
    const callArgs = onBlockUpdate.mock.calls[0][1]
    expect(callArgs.members).toHaveLength(3)
    expect(callArgs.members.map((m: TeamMember) => m.name)).not.toContain('Member 2')
    expect(callArgs.members[0]).toEqual({ name: 'Member 1', role: 'Role', bio: '' })
    expect(callArgs.members[1]).toEqual({ name: 'Member 3', role: 'Role', bio: '' })
  })

  // TC-F05-894-07
  it('✕ button disabled when count = 1', () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: [{ name: 'Solo', role: 'Solo', bio: '' }] }), onBlockUpdate)
    const removeButton = screen.getByRole('button', { name: /Remove member/i })
    expect(removeButton).toBeDisabled()
  })

  // TC-F05-894-08
  it('editing name field on blur updates member name', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ members: [{ name: 'Original Name', role: 'Role', bio: 'Bio' }] }), onBlockUpdate)
    const nameInput = container.querySelector('input[placeholder="Member name"]') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } })
    fireEvent.blur(nameInput)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      members: expect.arrayContaining([expect.objectContaining({ name: 'Updated Name', role: 'Role' })]),
    }))
  })

  // TC-F05-894-09
  it('editing role field on blur updates member role', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ members: [{ name: 'Member', role: 'Original Role', bio: 'Bio' }] }), onBlockUpdate)
    const roleInput = container.querySelector('input[placeholder="Role / title"]') as HTMLInputElement
    fireEvent.change(roleInput, { target: { value: 'Updated Role' } })
    fireEvent.blur(roleInput)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      members: expect.arrayContaining([expect.objectContaining({ name: 'Member', role: 'Updated Role' })]),
    }))
  })

  // TC-F05-894-10
  it('editing bio field on blur updates member bio', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ members: [{ name: 'Member', role: 'Role', bio: 'Original Bio' }] }), onBlockUpdate)
    const bioInput = container.querySelector('textarea[placeholder="Short bio"]') as HTMLTextAreaElement
    fireEvent.change(bioInput, { target: { value: 'Updated Bio' } })
    fireEvent.blur(bioInput)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      members: expect.arrayContaining([expect.objectContaining({ name: 'Member', role: 'Role', bio: 'Updated Bio' })]),
    }))
  })
})

describe('TeamSettings — mount behavior', () => {
  // TC-F05-894-11
  it('mounts with empty members and pads to 3 via useEffect', async () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: [] }), onBlockUpdate)
    await waitFor(() => {
      expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
        members: expect.arrayContaining([
          { name: 'Team Member 1', role: 'Role', bio: '' },
          { name: 'Team Member 2', role: 'Role', bio: '' },
          { name: 'Team Member 3', role: 'Role', bio: '' },
        ]),
      }))
    })
  })

  // TC-F05-894-12
  it('mounts with 1 existing member and does NOT pad (already >= 1)', async () => {
    const onBlockUpdate = vi.fn()
    renderPanel(makeBlock({ members: [{ name: 'Original Member', role: 'CEO', bio: 'CEO bio' }] }), onBlockUpdate)
    // Verify no padding occurs — component initializes with 1 member
    expect(screen.getByText('1')).toBeInTheDocument()
    // Should not call onBlockUpdate for padding since length >= 1
    await new Promise(resolve => setTimeout(resolve, 100))
    const paddingCalls = onBlockUpdate.mock.calls.filter((call: any[]) => {
      const members = call[1]?.members
      return members && members.length > 1
    })
    expect(paddingCalls).toHaveLength(0)
  })

  // TC-F05-894-13
  it('mounts with 3+ existing members and does not pad', async () => {
    const onBlockUpdate = vi.fn()
    const existingMembers = Array(4).fill(null).map((_, i) => ({ name: `Member ${i + 1}`, role: 'Role', bio: '' }))
    renderPanel(makeBlock({ members: existingMembers }), onBlockUpdate)
    // Should not call onBlockUpdate with padding
    await new Promise(resolve => setTimeout(resolve, 100))
    // Only check if there was an update call from padding
    const paddingCalls = onBlockUpdate.mock.calls.filter((call: any[]) => {
      const members = call[1]?.members
      return members && members.length > 4
    })
    expect(paddingCalls).toHaveLength(0)
  })
})

describe('TeamSettings — image handling', () => {
  // TC-F05-894-14
  it('image upload via BlockImageEditor updates member image', () => {
    const onBlockUpdate = vi.fn()
    const { container } = renderPanel(makeBlock({ members: [{ name: 'Member', role: 'Role', bio: '' }] }), onBlockUpdate)
    const uploadButton = screen.getByRole('button', { name: /Mock Upload/i })
    fireEvent.click(uploadButton)
    expect(onBlockUpdate).toHaveBeenCalledWith(0, expect.objectContaining({
      members: expect.arrayContaining([
        expect.objectContaining({
          name: 'Member',
          image: expect.objectContaining({ url: 'mock-image-url.jpg' }),
        }),
      ]),
    }))
  })
})
