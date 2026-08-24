import { fireEvent, render } from '@testing-library/react-native';

import { CatalogArtwork } from './CatalogArtwork';

describe('CatalogArtwork', () => {
  it('shows a fallback when artwork_url is null and labels it with the title', async () => {
    const view = await render(<CatalogArtwork size="card" title="Harbor Lights" uri={null} />);

    expect(view.getByTestId('catalog-artwork-fallback')).toBeTruthy();
    expect(view.queryByTestId('catalog-artwork-image')).toBeNull();
    expect(view.getByLabelText('Harbor Lights')).toBeTruthy();
  });

  it('shows a fallback when the image fails to load', async () => {
    const view = await render(
      <CatalogArtwork size="hero" title="Harbor Lights" uri="https://example.test/broken.png" />,
    );

    expect(view.getByTestId('catalog-artwork-image')).toBeTruthy();
    await fireEvent(view.getByTestId('catalog-artwork-image'), 'error');
    expect(view.getByTestId('catalog-artwork-fallback')).toBeTruthy();
    expect(view.queryByTestId('catalog-artwork-image')).toBeNull();
    expect(view.getByLabelText('Harbor Lights')).toBeTruthy();
  });
});
