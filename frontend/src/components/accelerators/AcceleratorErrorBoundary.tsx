import { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  acceleratorName: string
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class AcceleratorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.acceleratorName}] error boundary caught:`, error, info)
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
          <svg
            className="w-12 h-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {this.props.acceleratorName} encountered an error
            </h2>
            <p className="mt-1 text-sm text-gray-500">{this.state.error?.message}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleTryAgain}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = "/home" }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
