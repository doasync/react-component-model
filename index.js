
const React = require('react');
const PropTypes = require('prop-types');

const { useContext, useMemo } = React;
const invariant = require('invariant');

const componentModelMap = new WeakMap();
const componentContextMap = new WeakMap();

function getDisplayName (Component) {
  return Component.displayName || Component.name || 'Component';
}

function bindModel (
  Component,
  componentModel,
  Context = React.createContext(),
) {
  componentModelMap.set(Component, componentModel);
  componentContextMap.set(Component, Context);
}

function getBoundData (Component) {
  const modelFactory = componentModelMap.get(Component);
  const ComponentContext = componentContextMap.get(Component);

  invariant(
    modelFactory && ComponentContext,
    `You need to bind a model to your component: ${getDisplayName(Component)}`,
  );

  return { modelFactory, ComponentContext };
}

function useComponentModel (Component, Provider) {
  invariant(
    typeof Component === 'function',
    'You need to pass a component to useModel',
  );

  const { modelFactory, ComponentContext } = getBoundData(Component);
  const { ComponentContext: ProviderContext } = Provider
    ? getBoundData(Provider)
    : {};

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return (
    useContext(ProviderContext || ComponentContext) || useMemo(modelFactory)
  );
}

function createComponentProvider (Component, options) {
  invariant(
    typeof Component === 'function',
    'You need to pass a component to createComponentProvider',
  );

  const { modelFactory } = getBoundData(Component);
  const Context = React.createContext();

  const Provider = ({ children, disable, options: optionsFromProp }) => {
    const contextValue = disable
      ? undefined
      : modelFactory(optionsFromProp || options);

    return React.createElement(
      Context.Provider,
      { value: contextValue },
      children,
    );
  };

  Provider.propTypes = {
    disable: PropTypes.bool,
    options: PropTypes.shape({}),
    children: PropTypes.node.isRequired,
  };

  Provider.defaultProps = {
    disable: false,
    options: undefined,
  };

  bindModel(Provider, modelFactory, Context);

  return Provider;
}

function Consumer (props) {
  const { children, of: Component } = props;

  invariant(
    typeof children === 'function',
    'Consumer expects a single child that is a function must be a function',
  );

  const { ComponentContext } = getBoundData(Component);

  return React.createElement(
    ComponentContext.Consumer,
    null,
    model => children(model),
  );
}

Consumer.propTypes = {
  of: PropTypes.func.isRequired,
  children: PropTypes.func.isRequired,
};

module.exports = {
  bindModel,
  getBoundData,
  useComponentModel,
  createComponentProvider,
  Consumer,
};
