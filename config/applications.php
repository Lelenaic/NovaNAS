<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Store Provider
    |--------------------------------------------------------------------------
    |
    | The default application store provider to use. This should match one of
    | the keys defined in the 'stores' configuration array below.
    |
    */

    'default_store' => env('APP_STORE_DEFAULT', 'casaos'),

    /*
    |--------------------------------------------------------------------------
    | Store Providers
    |--------------------------------------------------------------------------
    |
    | Configure each available app store provider here. Each store must have
    | a 'base_url' pointing to the static dist/ output of the store, and an
    | optional 'enabled' flag to activate/deactivate it.
    |
    */

    'stores' => [

        'casaos' => [
            'enabled' => (bool) env('CASAOS_STORE_ENABLED', true),
            'base_url' => env('CASAOS_STORE_URL', 'https://cdn.jsdelivr.net/gh/IceWhaleTech/CasaOS-AppStore@gh-pages'),
        ],

    ],

];
