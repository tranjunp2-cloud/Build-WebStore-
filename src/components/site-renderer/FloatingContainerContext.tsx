'use client'

import { createContext, useContext } from 'react'

const FloatingContainerContext = createContext(false)

export const FloatingContainerProvider = FloatingContainerContext.Provider

/** Returns true when the block is rendered inside a SiteRenderer-managed floating stack container. */
export const useInFloatingContainer = () => useContext(FloatingContainerContext)
