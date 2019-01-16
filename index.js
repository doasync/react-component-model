// @flow
/* eslint-disable react/sort-comp, lines-between-class-members */

const React = require('react');
const PropTypes = require('prop-types');
const invariant = require('invariant');
const warning = require('warning');

const { useContext, useMemo } = React;

/*::
type Model = {}
type ModelOptions = {}
type ModelFactory = (options: ?ModelOptions) => Model
type ComponentContext = React.Context<?Model>
type ComponentData = {
  ComponentContext: ComponentContext,
  modelFactory: ModelFactory
}
type ComponentType = React.ComponentType<any>
type ComponentProviderProps = {
  children: React.Node,
  modelRef?: (Model) => void,
  options?: ModelOptions,
  fallback?: React.Node
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
  ComponentContext /*: ComponentContext */,
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
  ComponentContext /*: ComponentContext */,
  options /*: ?ModelOptions */,
) /*: ComponentProvider */ {
  const modelRefSet = new WeakSet();

  // TODO: Refactor to function component
  class Provider extends React.PureComponent /*:: <ComponentProviderProps> */ {
    static propTypes = {
      modelRef: PropTypes.func,
      options: PropTypes.objectOf(PropTypes.any),
      children: PropTypes.node.isRequired,
      fallback: PropTypes.node,
    };

    static defaultProps = {
      modelRef: undefined,
      options: undefined,
      fallback: undefined,
    }

    model;
    promise;

    constructor (props) {
      super(props);

      const providerName = getDisplayName(Provider);
      const { modelRef, options: optionsFromProps } = props;

      this.model = modelFactory(optionsFromProps || options);

      if (typeof modelRef === 'function') {
        warning(
          !modelRefSet.has(modelRef),
          `You should not pass single modelRef function to multiple providers (${providerName})`,
        );

        const refResult = modelRef(this.model);

        if (refResult && refResult.then === 'function') {
          this.promise = refResult;
        }

        modelRefSet.add(modelRef);
      }
    }

    componentDidMount () {
      if (this.promise) {
        // eslint-disable-next-line promise/catch-or-return
        this.promise.then(() => this.forceUpdate());
      }
    }

    render () {
      const { children, fallback = null } = this.props;

      if (this.promise) {
        return fallback;
      }

      return React.createElement(
        ComponentContext.Provider,
        { value: this.model },
        children,
      );
    }
  }

  return Provider;
}

function connectModel (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
  options /*: ?ModelOptions */,
) /*: void */ {
  const componentName = getDisplayName(Component);

  invariant(
    typeof Component === 'function' && typeof modelFactory === 'function',
    'connectModel expects a component and a model factory',
  );

  invariant(
    !Component.prototype.render,
    `You cannot connect class components: "${componentName}"`,
  );

  const ComponentContext = Component.contextType !== undefined
    ? Component.contextType
    : React.createContext();

  invariant(
    ComponentContext && ComponentContext.Provider && ComponentContext.Consumer,
    `Invalid context is provided to "${componentName}" component`,
  );

  bindComponentData(Component, modelFactory, ComponentContext);

  /* eslint-disable no-param-reassign */
  Component.Provider = providerFactory(modelFactory, ComponentContext, options);
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
  options /*: ?ModelOptions */,
) /*: ModelComponent */ {
  invariant(
    typeof Component === 'function',
    'createCustomComponent expects a base component',
  );

  const { ComponentContext, modelFactory } = getComponentData(Component);
  const CustomContext = React.createContext();

  const CustomComponent = (props) => {
    const model = useContext(CustomContext);

    return (
      <ComponentContext.Provider value={model}>
        <Component {...props} />
      </ComponentContext.Provider>
    );
  };

  CustomComponent.contextType = CustomContext;
  CustomComponent.displayName = `Custom$${getDisplayName(Component)}`;

  connectModel(CustomComponent, modelFactory, options);

  return CustomComponent;
}

module.exports = {
  connectModel,
  useModel,
  getComponentData,
  createCustomComponent,
};
