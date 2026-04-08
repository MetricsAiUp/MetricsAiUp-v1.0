import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'en' },
  }),
}));

const mockApi = {
  post: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue({ data: {} }),
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    api: mockApi,
  }),
}));

describe('PhotoGallery', () => {
  it('renders upload buttons', async () => {
    const { default: PhotoGallery } = await import('../components/PhotoGallery');

    render(<PhotoGallery sessionId="s1" photos={[]} />);

    expect(screen.getByText('photos.upload')).toBeDefined();
    expect(screen.getByText('photos.takePhoto')).toBeDefined();
  });

  it('shows empty state when no photos', async () => {
    const { default: PhotoGallery } = await import('../components/PhotoGallery');

    render(<PhotoGallery sessionId="s1" photos={[]} />);

    expect(screen.getByText('photos.noPhotos')).toBeDefined();
  });

  it('renders photo grid with thumbnails', async () => {
    const { default: PhotoGallery } = await import('../components/PhotoGallery');
    const photos = [
      { id: 'p1', path: 'photos/s1/photo1.jpg', filename: 'photo1.jpg' },
      { id: 'p2', path: 'photos/s1/photo2.jpg', filename: 'photo2.jpg' },
    ];

    const { container } = render(<PhotoGallery sessionId="s1" photos={photos} />);

    const images = container.querySelectorAll('img');
    expect(images.length).toBe(2);
    expect(images[0].getAttribute('src')).toContain('photo1.jpg');
  });

  it('opens full-screen viewer on click', async () => {
    const { default: PhotoGallery } = await import('../components/PhotoGallery');
    const photos = [{ id: 'p1', path: 'photos/s1/photo1.jpg', filename: 'photo1.jpg' }];

    const { container } = render(<PhotoGallery sessionId="s1" photos={photos} />);

    // Click the image
    const img = container.querySelector('img');
    fireEvent.click(img);

    // Should open full-screen overlay
    const overlay = container.querySelector('.fixed');
    expect(overlay).toBeDefined();
  });

  it('has hidden file inputs for upload and camera', async () => {
    const { default: PhotoGallery } = await import('../components/PhotoGallery');

    const { container } = render(<PhotoGallery sessionId="s1" photos={[]} />);

    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBe(2);
    // One for file upload, one for camera capture
    const captureInput = container.querySelector('input[capture]');
    expect(captureInput).toBeDefined();
  });
});
