// @flow
/* eslint-disable strict */

'use strict';

const PropTypes = require('prop-types');
const invariant = require('invariant');
const React = require('./react');

const { useContext, useMemo } = React;

/*::
type ModelData = {}
type ModelOptions = {}
type ModelFactory = (options: ?ModelOptions) => ModelData
type ContextValue = {}
type ComponentData = {
  ComponentContext: React.Context<?ContextValue>,
  modelFactory: ModelFactory
}
type ComponentType = React.ComponentType<{}>
type BoundProvider = React.ComponentType<{
  children: React.Node,
  disable?: boolean,
  options?: ModelOptions
}>
type BoundComponent = ComponentType | BoundProvider
// $FlowIgnore
type DataMap = WeakMap<BoundComponent, ComponentData>
type ConsumerProps = {
  children: (value: ?ContextValue) => ?React.Node,
  of: BoundComponent,
}
*/

const componentDataMap /*: DataMap */ = new WeakMap();

function getDisplayName (Component /*: BoundComponent */) /*: string */ {
  // flowlint-next-line sketchy-null-string: off
  return Component.displayName || Component.name || 'Component';
}

function bindData (
  Component /*: ComponentType */,
  data /*: ComponentData */,
) /*: void */ {
  componentDataMap.set(Component, data);
}

function getBoundData (Component /*: BoundComponent */) /*: ComponentData */ {
  const componentData = componentDataMap.get(Component);

  invariant(componentData, `You need to bind a model to your component "${getDisplayName(Component)}" using bindModel`);

  return componentData;
}

function providerFactory (
  Context /*: React.Context<?ContextValue> */,
  modelFactory /*: ModelFactory */,
  options /*: ?ModelOptions */,
) /*: BoundProvider */ {
  const Provider = ({
    children,
    disable,
    options: optionsFromProp,
  }) => {
    const contextValue = disable
      ? undefined
      : modelFactory(optionsFromProp || options);

    return React.createElement(Context.Provider, { value: contextValue }, children);
  };

  bindData(Provider, {
    modelFactory,
    ComponentContext: Context,
  });

  Provider.propTypes = {
    disable: PropTypes.bool,
    options: PropTypes.shape({}),
    children: PropTypes.node.isRequired,
  };

  Provider.defaultProps = {
    disable: false,
    options: undefined,
  };

  return Provider;
}

function bindModel (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
  ComponentContext /*: React.Context<?ContextValue> */ = React.createContext(),
) /*: void */ {
  invariant(
    typeof Component === 'function'
    && typeof modelFactory === 'function'
    && ComponentContext
    && ComponentContext.Provider
    && ComponentContext.Consumer,
    'bindModel expects a component and a model factory (optionally a context)',
  );

  bindData(Component, {
    modelFactory,
    ComponentContext,
  });

  // eslint-disable-next-line no-param-reassign
  Component.Consumer = ComponentContext.Consumer;
  // eslint-disable-next-line no-param-reassign
  Component.Provider = providerFactory(ComponentContext, modelFactory);
}

function useComponentModel (
  Component /*: BoundComponent */,
  Provider /*: ?BoundProvider */,
) /*: ModelData */ {
  invariant(
    typeof Component === 'function',
    'useComponentModel expects a component',
  );

  const { modelFactory, ComponentContext } = getBoundData(Component);
  const { ComponentContext: ProviderContext } = Provider
    ? getBoundData(Provider)
    : {};

  return (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useContext(ProviderContext || ComponentContext) || useMemo(modelFactory)
  );
}

function createComponentProvider (
  Component /*: BoundComponent */,
  options /*: ?ModelOptions */,
) /*: BoundProvider */ {
  invariant(
    typeof Component === 'function',
    'createComponentProvider expects a component',
  );

  const { modelFactory } = getBoundData(Component);
  const Context = React.createContext();

  return providerFactory(Context, modelFactory, options);
}

function Consumer (props /*: ConsumerProps */) {
  const { children, of: Component } = props;

  invariant(
    typeof children === 'function',
    'Consumer expects a single child that is a function',
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
  React,
};
