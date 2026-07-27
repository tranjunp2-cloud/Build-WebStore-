import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { wipeQcCollection } from '../../../../scripts/qc-reset-helpers'

function mockPayload() {
  return {
    find: vi.fn(),
    delete: vi.fn(),
  }
}

describe('[TC-GH1432-QC-03] QC reset safety', () => {
  it('deletes every document in bounded batches', async () => {
    // Arrange
    const payload = mockPayload()
    payload.find
      .mockResolvedValueOnce({ docs: [{ id: 1 }, { id: 2 }] })
      .mockResolvedValueOnce({ docs: [] })
    payload.delete.mockResolvedValue({})

    // Act
    const deleted = await wipeQcCollection(payload as unknown as Payload, 'products')

    // Assert
    expect(deleted).toBe(2)
    expect(payload.delete).toHaveBeenCalledTimes(2)
    expect(payload.find).toHaveBeenCalledTimes(2)
  })

  it('fails the reset immediately when a document cannot be deleted', async () => {
    // Arrange
    const payload = mockPayload()
    payload.find.mockResolvedValue({ docs: [{ id: 42 }] })
    payload.delete.mockRejectedValue(new Error('foreign key violation'))

    // Act
    const result = wipeQcCollection(payload as unknown as Payload, 'products')

    // Assert
    await expect(result).rejects.toThrow(
      'Failed to delete 1 document(s): products#42: foreign key violation',
    )
    expect(payload.find).toHaveBeenCalledTimes(1)
  })

  it('fails instead of looping when a deleted document is returned again', async () => {
    // Arrange
    const payload = mockPayload()
    payload.find.mockResolvedValue({ docs: [{ id: 42 }] })
    payload.delete.mockResolvedValue({})

    // Act
    const result = wipeQcCollection(payload as unknown as Payload, 'products')

    // Assert
    await expect(result).rejects.toThrow(
      'QC reset made no progress for products: document 42 was returned after deletion',
    )
    expect(payload.find).toHaveBeenCalledTimes(2)
    expect(payload.delete).toHaveBeenCalledTimes(1)
  })
})
