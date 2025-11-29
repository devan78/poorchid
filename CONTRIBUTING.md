# Contributing to Poorchid

We welcome contributions to Poorchid! Whether you're fixing a bug, improving documentation, or adding a new feature, your help is appreciated.

## How to Contribute

1.  **Fork the repository** on GitHub.
2.  **Clone your fork** locally.
3.  **Create a branch** for your feature or fix:
    ```bash
    git checkout -b feature/amazing-feature
    ```
4.  **Make your changes**.
5.  **Run tests** to ensure no regressions:
    ```bash
    npm test
    ```
6.  **Commit your changes** with clear messages.
7.  **Push to your fork**.
8.  **Submit a Pull Request**.

## Development Guidelines

-   **Code Style**: We use standard JavaScript style. Please ensure your code is clean and readable.
-   **Testing**: All new logic must be covered by tests. We use Vitest.
-   **Architecture**: Keep logic separated from UI. Put domain logic in `src/chord-logic.js` or similar, and keep `src/main.js` for wiring things together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
