import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Movie from '../Movie';
import MovieInfo from '../MovieInfo';
import AspectGraph from '../AspectGraph';
import Error from '../Error';
import VibeCheck from '../VibeCheck';
import { useLocation } from 'react-router-dom';

// Mock the react-router-dom useLocation hook
vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}));

// Mock the component dependencies
vi.mock('../MovieInfo', () => {
  return {
    default: vi.fn(() => <div data-testid="movie">Movie Component</div>),
  };
});

vi.mock('../AspectGraph', () => {
  return {
    default: vi.fn(({ data }) => (
      <div data-testid="aspect-graph">
        Aspect Graph Component: {JSON.stringify(data)}
      </div>
    )),
  };
});

vi.mock('../Video', () => {
  return {
    default: vi.fn(() => <div data-testid="video">Loading Video</div>),
  };
});

vi.mock('../Error', () => {
  return {
    default: vi.fn(() => <div data-testid="error">Error Component</div>),
  };
});

vi.mock('../VibeCheck', () => {
  return {
    default: vi.fn(({ filmUrl }) => (
      <div data-testid="vibe-check">
        Vibe Check Component (filmUrl:{' '}
        {filmUrl === undefined ? 'undefined' : filmUrl})
      </div>
    )),
  };
});

describe('Movie Component', () => {
  const mockSearchQuery = 'https://letterboxd.com/film/test-movie/';

  // Mock fetch before each test
  beforeEach(() => {
    global.fetch = vi.fn();
    console.error = vi.fn();

    // Mock the useLocation hook to return a searchQuery
    useLocation.mockReturnValue({
      state: { searchQuery: mockSearchQuery },
    });
  });

  // Clean up after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays loading video while fetching data', async () => {
    // Mock a slow response
    global.fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    movie_details: {
                      movie_name: 'Test Movie',
                      director: 'Test Director',
                      year: '2023',
                      genres: 'Action, Drama',
                      backdrop_image_url: 'test-image.jpg',
                      synopsis: 'Test synopsis',
                    },
                    summary: 'Test review',
                  }),
              }),
            100
          )
        )
    );

    render(<Movie />);

    // Should show the loading video initially
    expect(screen.getByTestId('video')).toBeInTheDocument();

    // Wait for loading to complete and verify it's gone
    await waitFor(
      () => {
        expect(screen.queryByTestId('video')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('renders MovieInfo with correct data after successful fetch', async () => {
    // Mock successful API response with the new format
    const mockMovieData = {
      movie_details: {
        movie_name: 'Test Movie',
        director: 'Test Director',
        year: '2023',
        genres:
          'Action, Drama, Adventure, Comedy, Thriller, Horror, Documentary',
        backdrop_image_url: 'test-image.jpg',
        synopsis: 'Test synopsis',
      },
      summary: 'Test review',
      aspects: [['Test aspect', 80, 5]],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMovieData),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that MovieInfo was called with the correctly processed data
    // It should only include the first 5 genres
    expect(MovieInfo).toHaveBeenCalled();
    const firstCall = MovieInfo.mock.calls[0][0];
    expect(firstCall.name).toBe('Test Movie');
    expect(firstCall.director).toBe('Test Director');
    expect(firstCall.year).toBe('2023');
    expect(firstCall.genres).toEqual([
      'Action',
      'Drama',
      'Adventure',
      'Comedy',
      'Thriller',
    ]);
    expect(firstCall.backgroundImage).toBe('test-image.jpg');
    expect(firstCall.synopsis).toBe('Test synopsis');
    expect(firstCall.review).toBe('Test review');

    // Check that AspectGraph is rendered with the correct data
    expect(AspectGraph).toHaveBeenCalled();
    expect(AspectGraph.mock.calls[0][0].data).toEqual(mockMovieData.aspects);
    expect(screen.getByTestId('aspect-graph')).toBeInTheDocument();
  });

  it('does not render AspectGraph when aspects data is empty', async () => {
    // Mock successful API response with no aspects data
    const mockMovieData = {
      movie_details: {
        movie_name: 'Test Movie',
        director: 'Test Director',
        year: '2023',
        genres: 'Action, Drama',
        backdrop_image_url: 'test-image.jpg',
        synopsis: 'Test synopsis',
      },
      summary: 'Test review',
      aspects: [], // Empty aspects array
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockMovieData),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // AspectGraph should not be rendered
    expect(screen.queryByTestId('aspect-graph')).not.toBeInTheDocument();
    expect(AspectGraph).not.toHaveBeenCalled();
  });

  it('shows error component when fetch fails', async () => {
    // Mock failed API response
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<Movie />);

    // Wait for error component to appear
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });

    // Verify that error was logged to console
    expect(console.error).toHaveBeenCalled();
  });

  it('shows error component when API returns non-OK response', async () => {
    // Mock API error response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    render(<Movie />);

    // Wait for error component to appear
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('handles missing data in API response', async () => {
    // Mock API response with minimal data
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'Minimal Movie',
            director: 'Some Director',
            year: '2022',
            // Missing genres, backdrop_image_url, etc.
          },
          // Missing summary
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that MovieInfo handles missing data gracefully
    expect(MovieInfo).toHaveBeenCalled();
    const movieInfoProps = MovieInfo.mock.calls[0][0];
    expect(movieInfoProps.name).toBe('Minimal Movie');
    expect(movieInfoProps.director).toBe('Some Director');
    expect(movieInfoProps.year).toBe('2022');
    expect(movieInfoProps.genres).toEqual([]);
    expect(movieInfoProps.review).toBe('No review available');
    expect(movieInfoProps.backgroundImage).toBeUndefined();
    expect(movieInfoProps.synopsis).toBeUndefined();
    expect(movieInfoProps.aspects).toEqual([]);

    // AspectGraph should not be rendered with empty aspects
    expect(screen.queryByTestId('aspect-graph')).not.toBeInTheDocument();
  });

  it('handles empty genres string correctly', async () => {
    // Mock API response with empty genres string
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'No Genres Movie',
            director: 'Genre Director',
            year: '2022',
            genres: '',
            backdrop_image_url: 'test-image.jpg',
            synopsis: 'A movie without genres',
          },
          summary: 'Test review',
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that MovieInfo receives empty array for genres
    expect(MovieInfo).toHaveBeenCalled();
    const firstCall = MovieInfo.mock.calls[0][0];
    expect(firstCall.genres).toEqual([]);
  });

  it('handles exactly 5 genres correctly', async () => {
    // Mock API response with exactly 5 genres
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'Five Genres Movie',
            director: 'Five Director',
            year: '2022',
            genres: 'Action, Comedy, Drama, Thriller, Horror',
            backdrop_image_url: 'test-image.jpg',
            synopsis: 'A movie with exactly five genres',
          },
          summary: 'Test review',
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that MovieInfo receives all 5 genres
    expect(MovieInfo).toHaveBeenCalled();
    const firstCall = MovieInfo.mock.calls[0][0];
    expect(firstCall.genres).toEqual([
      'Action',
      'Comedy',
      'Drama',
      'Thriller',
      'Horror',
    ]);
  });

  it('renders VibeCheck component with the correct filmUrl prop', async () => {
    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'Test Movie',
            director: 'Test Director',
            year: '2023',
            genres: 'Action, Drama',
            backdrop_image_url: 'test-image.jpg',
            synopsis: 'Test synopsis',
          },
          summary: 'Test review',
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that VibeCheck is rendered
    expect(screen.getByTestId('vibe-check')).toBeInTheDocument();

    // Check that VibeCheck was called with the correct filmUrl prop
    expect(VibeCheck).toHaveBeenCalled();

    // Get the props passed to VibeCheck
    const vibeCheckProps = VibeCheck.mock.calls[0][0];
    expect(vibeCheckProps.filmUrl).toBe(mockSearchQuery);

    // Verify the rendered text contains the correct filmUrl
    expect(screen.getByTestId('vibe-check').textContent).toContain(
      `filmUrl: ${mockSearchQuery}`
    );
  });

  it('always renders VibeCheck component even when aspects are empty', async () => {
    // Mock successful API response with no aspects data
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'Test Movie',
            director: 'Test Director',
            year: '2023',
            genres: 'Action, Drama',
            backdrop_image_url: 'test-image.jpg',
            synopsis: 'Test synopsis',
          },
          summary: 'Test review',
          aspects: [], // Empty aspects array
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // AspectGraph should not be rendered
    expect(screen.queryByTestId('aspect-graph')).not.toBeInTheDocument();

    // VibeCheck should still be rendered
    expect(screen.getByTestId('vibe-check')).toBeInTheDocument();
  });

  it('passes the correct searchQuery to VibeCheck when null (handles undefined values)', async () => {
    // Mock the useLocation hook to return undefined searchQuery
    useLocation.mockReturnValue({
      state: { searchQuery: undefined },
    });

    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          movie_details: {
            movie_name: 'Test Movie',
            director: 'Test Director',
            year: '2023',
            genres: 'Action, Drama',
            backdrop_image_url: 'test-image.jpg',
            synopsis: 'Test synopsis',
          },
          summary: 'Test review',
        }),
    });

    render(<Movie />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('movie')).toBeInTheDocument();
    });

    // Check that VibeCheck is rendered with undefined filmUrl
    expect(screen.getByTestId('vibe-check')).toBeInTheDocument();

    // Get the props passed to VibeCheck
    const vibeCheckProps = VibeCheck.mock.calls[0][0];
    expect(vibeCheckProps.filmUrl).toBeUndefined();

    // Verify the rendered text shows undefined filmUrl
    expect(screen.getByTestId('vibe-check').textContent).toContain(
      'filmUrl: undefined'
    );
  });
});
