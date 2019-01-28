// @flow strict
/* eslint-disable react/sort-comp, lines-between-class-members */

const React = require('react');
const PropTypes = require('prop-types');
const invariant = require('invariant');
const warning = require('warning');

const { useContext, useMemo } = React;

/*::
type Model = {}
type ModelConfig = {}
type ModelFactory = (config: ?ModelConfig) => Model
type ComponentContextType = React.Context<?Model>
type ComponentData = {
  ComponentContext: ComponentContextType,
  modelFactory: ModelFactory
}
type ComponentType = React.ComponentType<any>
type ComponentProviderProps = {
  children: React.Node,
  modelRef?: (Model) => void,
  config?: ModelConfig,
  fallback?: React.Node
}
type ConnectOptions = {
  context?: ComponentContextType,
  config?: ?ModelConfig
}
type ComponentProvider = React.ComponentType<ComponentProviderProps>
type ModelComponent = ComponentType
// $FlowFixMe: WeakMap currently supports only objects as keys (not functions)
type ComponentDataMap = WeakMap<ModelComponent, ComponentData>
*/

const componentDataMap /*: ComponentDataMap */ = new WeakMap();

function getDisplayName (Component /*: ComponentType */) /*: string */ {
  // flowlint-next-line sketchy-null-string: off
  return Component.displayName || Component.name || 'Component';
}

function bindComponentData (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
  ComponentContext /*: ComponentContextType */,
) /*: void */ {
  componentDataMap.set(Component, { modelFactory, ComponentContext });
}

function getComponentData (
  Component /*: ModelComponent */,
) /*: ComponentData */ {
  const componentData = componentDataMap.get(Component);
  const componentName = getDisplayName(Component);

  // For errors in a component
  warning(
    componentData,
    `"${componentName}" component is not connected to a model`,
  );

  invariant(
    componentData,
    `You need to connect a model to "${componentName}" component (using connectModel)`,
  );

  return componentData;
}

function providerFactory (
  modelFactory /*: ModelFactory */,
  ComponentContext /*: ComponentContextType */,
  config /*: ?ModelConfig */,
) /*: ComponentProvider */ {
  const modelRefSet = new WeakSet();

  const Provider = React.memo((props /*: ComponentProviderProps */) => {
    const { modelRef, config: configFromProps } = props;

    const model = useMemo(() => modelFactory(configFromProps || config), []);

    useMemo(() => {
      if (typeof modelRef === 'function') {
        const providerName = getDisplayName(Provider);

        warning(
          !modelRefSet.has(modelRef),
          `You should not pass single modelRef function to multiple providers (${providerName})`,
        );

        modelRefSet.add(modelRef);

        modelRef(model);
      }
    }, []);

    const { children } = props;

    return React.createElement(
      ComponentContext.Provider,
      { value: model },
      children,
    );
  });

  Provider.propTypes = {
    modelRef: PropTypes.func,
    config: PropTypes.objectOf(PropTypes.any),
    children: PropTypes.node.isRequired,
  };

  // $FlowFixMe: defaultProps
  Provider.defaultProps = {
    modelRef: undefined,
    config: undefined,
  };

  return Provider;
}

function connectModel (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
  options /*: ConnectOptions */ = {},
) /*: void */ {
  const componentName = getDisplayName(Component);
  const { context, config } = options;

  invariant(
    typeof Component === 'function' && typeof modelFactory === 'function',
    'connectModel expects a component and a model factory',
  );

  invariant(
    !Component.prototype.render,
    `You cannot connect class components: "${componentName}"`,
  );

  const ComponentContext = context !== undefined ? context : React.createContext();

  invariant(
    ComponentContext && ComponentContext.Provider && ComponentContext.Consumer,
    `Invalid context is provided to connectModel for "${componentName}" component`,
  );

  bindComponentData(Component, modelFactory, ComponentContext);

  /* eslint-disable no-param-reassign */
  Component.Provider = providerFactory(modelFactory, ComponentContext, config);
  Component.Provider.displayName = `${componentName}.Provider`;
  Component.Consumer = ComponentContext.Consumer;
  /* eslint-enable no-param-reassign */
}

function useModel (Component /*: ModelComponent */) /*: Model */ {
  invariant(typeof Component === 'function', 'useModel expects a component');

  const { ComponentContext, modelFactory } = useMemo(
    () => getComponentData(Component),
    [],
  );

  const defaultModel = useMemo(modelFactory, []);

  return useContext(ComponentContext) || defaultModel;
}

function createCustomComponent (
  Component /*: ModelComponent */,
  config /*: ModelConfig */,
) /*: ModelComponent */ {
  invariant(
    typeof Component === 'function',
    'createCustomComponent expects a base component',
  );

  const { ComponentContext, modelFactory } = getComponentData(Component);
  const CustomContext = React.createContext();

  const CustomComponent = (props) => {
    const model = useContext(CustomContext);

    return React.createElement(
      ComponentContext.Provider,
      {value: model},
      React.createElement(
        Component,
        {...props}
      )
    );
  };

  CustomComponent.displayName = `Custom$${getDisplayName(Component)}`;

  connectModel(CustomComponent, modelFactory, {
    context: CustomContext,
    config,
  });

  return CustomComponent;
}

module.exports = {
  connectModel,
  useModel,
  getComponentData,
  createCustomComponent,
};
