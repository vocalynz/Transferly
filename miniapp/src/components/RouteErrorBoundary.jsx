import React from 'react';
import { MiniAppState } from './MiniAppState';

export class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      resetKey: props.resetKey
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.resetKey) {
      return {
        error: null,
        resetKey: props.resetKey
      };
    }

    return null;
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('Route render failed', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <MiniAppState
          tone="error"
          title="This view needs a refresh"
          description="The page hit an unexpected state. Reloading the route usually restores it."
          actionLabel="Reload view"
          onAction={() => this.setState({ error: null })}
        />
      );
    }

    return this.props.children;
  }
}
