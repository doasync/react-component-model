// @flow
/* eslint-disable lines-between-class-members, react/sort-comp */

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

type BoundComponent = ComponentType
// $FlowFixMe: WeakMap currently supports only objects as keys (not functions)
type ComponentDataMap = WeakMap<BoundComponent, ComponentData>
type ClassInstance = { context: Model, constructor: ComponentType }
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
  Component /*: BoundComponent */,
) /*: ComponentData */ {
  const componentData = componentDataMap.get(Component);
  const componentName = getDisplayName(Component);

  // For errors in a component
  warning(
    componentData,
    `Your component "${componentName}" is not bound to a model`,
  );

  invariant(
    componentData,
    `You need to bind a model to your component "${componentName}" using bindModel`,
  );

  return componentData;
}

function createProvider (
  modelFactory /*: ModelFactory */,
  ComponentContext /*: ComponentContext */,
  options /*: ?ModelOptions */,
) /*: ComponentProvider */ {
  const modelRefSet = new WeakSet();

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

function bindModel (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
  options /*: ?ModelOptions */,
) /*: void */ {
  const componentName = getDisplayName(Component);

  invariant(
    typeof Component === 'function' && typeof modelFactory === 'function',
    'bindModel expects a component and a model factory',
  );

  if (Component.prototype.render) {
    invariant(
      Component.contextType,
      `"${componentName}" class component must have contextType`,
    );
  }

  const ComponentContext = Component.contextType !== undefined
    ? Component.contextType
    : React.createContext();

  invariant(
    ComponentContext && ComponentContext.Provider && ComponentContext.Consumer,
    `Invalid context is provided to "${componentName}" component`,
  );

  bindComponentData(Component, modelFactory, ComponentContext);

  /* eslint-disable no-param-reassign */
  Component.Provider = createProvider(modelFactory, ComponentContext, options);
  Component.Provider.displayName = `${componentName}.Provider`;
  Component.Consumer = ComponentContext.Consumer;
  /* eslint-enable no-param-reassign */
}

function useModel (Component /*: BoundComponent */) /*: Model */ {
  invariant(typeof Component === 'function', 'useModel expects a component');

  const { ComponentContext, modelFactory } = useMemo(
    () => getComponentData(Component),
    [],
  );

  const defaultModel = useMemo(modelFactory, []);

  return useContext(ComponentContext) || defaultModel;
}

const classModelMap = new WeakMap();

function getModel (self /*: ClassInstance */) /*: Model */ {
  const model = classModelMap.get(self);

  if (model === undefined) {
    invariant(
      self
      && self.constructor
      // $FlowFixMe: prototype
      && self.constructor.prototype.render,
      'getModel expects a class component instance (this keyword)',
    );

    // Also checks if component is bound to a model
    const { modelFactory } = getComponentData(self.constructor);

    if (self.context !== undefined) {
      classModelMap.set(self, self.context);
      return self.context;
    }

    const newModel = modelFactory();
    classModelMap.set(self, newModel);

    return newModel;
  }

  return model;
}

function createCustomComponent (
  Component /*: BoundComponent */,
  options /*: ?ModelOptions */,
) /*: BoundComponent */ {
  invariant(
    typeof Component === 'function',
    'createCustomComponent expects a base component',
  );

  const { ComponentContext, modelFactory } = getComponentData(Component);
  const CustomContext = React.createContext();

  // eslint-disable-next-line react/no-multi-comp
  class CustomComponent extends React.Component /*:: <{}> */ {
    static contextType = CustomContext;
    static Provider;
    static Consumer;

    render () {
      return (
        <ComponentContext.Provider value={this.context}>
          <Component {...this.props} />
        </ComponentContext.Provider>
      );
    }
  }

  CustomComponent.displayName = `Custom$${getDisplayName(Component)}`;

  bindModel(CustomComponent, modelFactory, options);

  return CustomComponent;
}

module.exports = {
  bindModel,
  useModel,
  getModel,
  createCustomComponent,
};
