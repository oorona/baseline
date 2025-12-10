import { pluginRegistry } from '../plugins';

// Import your custom plugins here
// import { myCustomPlugin } from './my-custom-plugin';

export function registerPlugins() {
    // Register your plugins here
    // pluginRegistry.register(myCustomPlugin);

    // Example:
    /*
    pluginRegistry.register({
        id: 'example-plugin',
        name: 'Example Plugin',
        routes: [],
        settingsComponent: ({ settings, onUpdate }) => (
            <div>
                <input 
                    value={settings.example_key || ''} 
                    onChange={e => onUpdate('example_key', e.target.value)} 
                />
            </div>
        )
    });
    */

    console.log('Plugins initialized');
}
