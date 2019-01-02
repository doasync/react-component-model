// @flow

const React = require('react');
const PropTypes = require('prop-types');
const invariant = require('invariant');

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
type ComponentType = React.ComponentType<{}>
type ComponentProvider = React.ComponentType<{
  children: React.Node,
  modelRef?: (Model) => void,
  options?: ModelOptions
}>
type BoundComponent = ComponentType
// $FlowFixMe
type ComponentDataMap = WeakMap<BoundComponent, ComponentData>
*/

const componentDataMap /*: ComponentDataMap */ = new WeakMap();
const modelRefSet = new WeakSet();

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

function getComponentData (Component /*: BoundComponent */) /*: ComponentData */ {
  const componentData = componentDataMap.get(Component);

  invariant(componentData, `You need to bind a model to your component "${getDisplayName(Component)}" using bindModel`);

  return componentData;
}

function providerFactory (
  ComponentContext /*: ComponentContext */,
  modelFactory /*: ModelFactory */,
  options /*: ?ModelOptions */,
) /*: ComponentProvider */ {
  const Provider = ({ children, modelRef, options: optionsFromProp }) => {
    const model = modelFactory(optionsFromProp || options);

    if (typeof modelRef === 'function') {
      invariant(!modelRefSet.has(modelRef), `You cannot pass single ref to multiple "${getDisplayName(Provider)}" providers`);

      modelRef(model);

      modelRefSet.add(modelRef);
    }

    return React.createElement(ComponentContext.Provider, { value: model }, children);
  };

  Provider.propTypes = {
    modelRef: PropTypes.func,
    options: PropTypes.objectOf(PropTypes.any),
    children: PropTypes.node.isRequired,
  };

  Provider.defaultProps = {
    modelRef: undefined,
    options: undefined,
  };

  return Provider;
}

function bindModel (
  Component /*: ComponentType */,
  modelFactory /*: ModelFactory */,
) /*: void */ {
  invariant(
    typeof Component === 'function' && typeof modelFactory === 'function',
    'bindModel expects a component and a model factory (and optionally a context)',
  );

  const ComponentContext = React.createContext();

  bindComponentData(Component, modelFactory, ComponentContext);

  // eslint-disable-next-line no-param-reassign
  Component.Consumer = ComponentContext.Consumer;
  // eslint-disable-next-line no-param-reassign
  Component.Provider = providerFactory(ComponentContext, modelFactory);
}

function useModel (Component /*: BoundComponent */) /*: Model */ {
  invariant(typeof Component === 'function', 'useModel expects a component');

  const { ComponentContext, modelFactory } = useMemo(
    () => getComponentData(Component), [],
  );

  const defaultModel = useMemo(modelFactory, []);

  return useContext(ComponentContext) || defaultModel;
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

  bindComponentData(CustomComponent, modelFactory, CustomContext);

  CustomComponent.Provider = providerFactory(
    CustomContext,
    modelFactory,
    options,
  );

  CustomComponent.Consumer = CustomContext.Consumer;

  return CustomComponent;
}

module.exports = {
  bindModel,
  useModel,
  createCustomComponent,
};
