import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AccessDeniedPage from '../app/access-denied/page'

describe('Frontend Smoke Test', () => {
    it('renders access denied page correctly', () => {
        render(<AccessDeniedPage />)
        expect(screen.getByText('Access Denied')).toBeDefined()
        expect(screen.getByText('Return Home')).toBeDefined()
    })
})
