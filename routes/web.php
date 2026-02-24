<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\SystemController;

Route::get('/', function () {
    return Inertia::render('Home');
});

Route::get('/api/system/info', [SystemController::class, 'info']);
