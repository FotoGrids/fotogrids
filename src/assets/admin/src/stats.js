/**
 * FotoGrids Statistics Page
 */

// FotoGrids Stats: Script loaded

class FotoGridsStats {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    render() {
        const container = document.getElementById('fotogrids-stats-page');
        
        if (!container) {
            console.error('FotoGrids Stats: Container element #fotogrids-stats-page not found!');
            return;
        }

        container.innerHTML = this.getStatsHTML();
        this.initializeCharts();
        this.loadStatsData();
    }

    getStatsHTML() {
        return `
            <div class="fotogrids-stats-dashboard">
                <!-- Overview Cards -->
                <div class="fotogrids-stats-cards">                    
                    <div class="fotogrids-stat-card" data-fotogrids-stat="albums">
                        <div class="stat-icon">${window.FotoGridsIcons?.layout || ''}</div>
                        <div class="stat-content">
                            <div class="stat-number" id="total-albums">0</div>
                            <div class="stat-label">Total Albums</div>
                        </div>
                    </div>

                    <div class="fotogrids-stat-card" data-fotogrids-stat="galleries">
                        <div class="stat-icon">${window.FotoGridsIcons?.layout_grid || ''}</div>
                        <div class="stat-content">
                            <div class="stat-number" id="total-galleries">0</div>
                            <div class="stat-label">Total Galleries</div>
                        </div>
                    </div>

					<div class="fotogrids-stat-card" data-fotogrids-stat="items">
                        <div class="stat-icon">${window.FotoGridsIcons?.remove_item || ''}</div>
                        <div class="stat-content">
                            <div class="stat-number" id="total-items">0</div>
                            <div class="stat-label">Total Items</div>
                        </div>
                    </div>
                    
                    <div class="fotogrids-stat-card" data-fotogrids-stat="views">
                        <div class="stat-icon">${window.FotoGridsIcons?.click || ''}</div>
                        <div class="stat-content">
                            <div class="stat-number" id="total-views">0</div>
                            <div class="stat-label">Total Views</div>
                        </div>
                    </div>
                </div>

                <!-- Charts Section -->
                <div class="fotogrids-stats-charts">
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>Views Over Time</h3>
                            <div class="chart-period">
                                <button class="period-btn active" data-period="7">7 Days</button>
                                <button class="period-btn" data-period="30">30 Days</button>
                                <button class="period-btn" data-period="90">90 Days</button>
                            </div>
                        </div>
                        <canvas id="views-chart"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <div class="chart-header">
                            <h3>Most Popular Galleries</h3>
                        </div>
                        <canvas id="popular-galleries-chart"></canvas>
                    </div>
                </div>

                <!-- Detailed Stats Tables -->
                <div class="fotogrids-stats-tables">
                    <div class="stats-table-container">
                        <h3>Recent Activity</h3>
                        <div class="stats-table-wrapper">
                            <table class="fotogrids-stats-table">
                                <thead>
                                    <tr>
                                        <th>Gallery/Album</th>
                                        <th>Type</th>
                                        <th>Views</th>
                                        <th>Last Viewed</th>
                                    </tr>
                                </thead>
                                <tbody id="recent-activity-table">
                                    <tr>
                                        <td colspan="4" class="loading">Loading...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="stats-table-container">
                        <h3>Top Performing Content</h3>
                        <div class="stats-table-wrapper">
                            <table class="fotogrids-stats-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Views</th>
                                        <th>Shares</th>
                                    </tr>
                                </thead>
                                <tbody id="top-content-table">
                                    <tr>
                                        <td colspan="4" class="loading">Loading...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeCharts() {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.error('FotoGrids Stats: Chart.js is not available');
            return;
        }
        
        // Views Over Time Chart
        const viewsCtx = document.getElementById('views-chart');
        if (viewsCtx) {
            this.viewsChart = new Chart(viewsCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Views',
                        data: [],
                        borderColor: '#3c46f0',
                        backgroundColor: 'rgba(60, 70, 240, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#3c46f0',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            });
        }

        // Popular Galleries Chart
        const popularCtx = document.getElementById('popular-galleries-chart');
        if (popularCtx) {
            this.popularChart = new Chart(popularCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#3c46f0',
                            '#5865f2',
                            '#4f5af3',
                            '#2d35c7',
                            '#f01e32'
                        ],
                        borderWidth: 0,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }

        // Period button handlers
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.loadViewsData(e.target.dataset.period);
            });
        });
    }

    async loadStatsData() {
        try {
            // Load overview stats
            const overviewResponse = await wp.apiFetch({
                path: 'fotogrids/v1/admin/stats/overview'
            });

            if (overviewResponse) {
                document.getElementById('total-galleries').textContent = overviewResponse.galleries || 0;
                document.getElementById('total-albums').textContent = overviewResponse.albums || 0;
                document.getElementById('total-items').textContent = overviewResponse.items || 0;
                document.getElementById('total-views').textContent = overviewResponse.views || 0;
            }

            // Load charts data
            this.loadViewsData(7);
            this.loadPopularGalleries();
            this.loadRecentActivity();
            this.loadTopContent();

        } catch (error) {
            console.error('Error loading stats data:', error);
            this.showNoDataMessage();
        }
    }

    async loadViewsData(days = 7) {
        try {
            const response = await wp.apiFetch({
                path: `fotogrids/v1/admin/stats/views?days=${days}`
            });

            if (response && this.viewsChart) {
                this.viewsChart.data.labels = response.labels || [];
                this.viewsChart.data.datasets[0].data = response.data || [];
                this.viewsChart.update();
            }
        } catch (error) {
            console.error('Error loading views data:', error);
        }
    }

    async loadPopularGalleries() {
        try {
            const response = await wp.apiFetch({
                path: 'fotogrids/v1/admin/stats/popular-galleries'
            });

            if (response && this.popularChart) {
                this.popularChart.data.labels = response.labels || [];
                this.popularChart.data.datasets[0].data = response.data || [];
                this.popularChart.update();
            }
        } catch (error) {
            console.error('Error loading popular galleries:', error);
        }
    }

    async loadRecentActivity() {
        try {
            const response = await wp.apiFetch({
                path: 'fotogrids/v1/admin/stats/recent-activity'
            });

            const tbody = document.getElementById('recent-activity-table');
            if (response && response.length > 0) {
                tbody.innerHTML = response.map(item => `
                    <tr>
                        <td><strong>${item.title}</strong></td>
                        <td><span class="type-badge type-${item.type}">${item.type}</span></td>
                        <td>${item.views}</td>
                        <td>${item.last_viewed}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="no-data">No recent activity</td></tr>';
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
            document.getElementById('recent-activity-table').innerHTML = 
                '<tr><td colspan="4" class="no-data">No data available</td></tr>';
        }
    }

    async loadTopContent() {
        try {
            const response = await wp.apiFetch({
                path: 'fotogrids/v1/admin/stats/top-content'
            });

            const tbody = document.getElementById('top-content-table');
            if (response && response.length > 0) {
                tbody.innerHTML = response.map(item => `
                    <tr>
                        <td><strong>${item.title}</strong></td>
                        <td><span class="type-badge type-${item.type}">${item.type}</span></td>
                        <td>${item.views}</td>
                        <td>${item.shares}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="no-data">No data available</td></tr>';
            }
        } catch (error) {
            console.error('Error loading top content:', error);
            document.getElementById('top-content-table').innerHTML = 
                '<tr><td colspan="4" class="no-data">No data available</td></tr>';
        }
    }

    showNoDataMessage() {
        // Show placeholder data with zeros
        document.getElementById('total-galleries').textContent = '0';
        document.getElementById('total-albums').textContent = '0';
        document.getElementById('total-items').textContent = '0';
        document.getElementById('total-views').textContent = '0';
    }
}

// Initialize when DOM is ready
new FotoGridsStats();
