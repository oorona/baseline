import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AccessDeniedPage from '../app/access-denied/page'

vi.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/',
}))

describe('Frontend Smoke Test', () => {
    it('renders access denied page correctly', () => {
        render(<AccessDeniedPage />)
        expect(screen.getByText('Access Denied')).toBeDefined()
        expect(screen.getByText('Return Home')).toBeDefined()
    })
})
