<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class HomeController extends Controller
{
    /**
     * Display the home page.
     */
    public function index()
    {
        return Inertia::render('Home', [
            'version' => config('app.version'),
        ]);
    }
}
