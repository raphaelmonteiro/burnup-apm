var module = angular.module('myApp', []);

module.controller('appController',
    ['$scope', 'getKanbanData',
        function ($scope, getKanbanData) {
            $scope.carregando = true;
            $scope.swimlane = [];
            $scope.form = {};
            $scope.result = [];
            $scope.blockTasks = [];

            $scope.chartOptions = {
                title: {
                    text: 'Burnup semanal - Equipe APM'
                },
                colors: ['blue', 'red'],
                xAxis: {
                    categories: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
                },
                series: [{
                    name: 'Ideal',
                    color: 'rgba(255,0,0,0.25)',
                    lineWidth: 2
                }, {
                    name: 'Atual',
                    color: 'rgba(0,120,200,0.75)',
                    marker: {
                        radius: 6
                    }
                }]
            };


            $scope.changeLane = function () {
                $scope.getInfoBoard(true);
            };

            $scope.getInfoBoard = function (privateLane) {
                $scope.carregando = true;
                $scope.result = [];
                $scope.blockTasks = [];
                getKanbanData().then(function (data) {
                    var swimlanes = $scope.form.swimlane ? [$scope.form.swimlane] : data.boardSettings.swimlanes;
                    angular.forEach(swimlanes, function (swimlane) {
                        var result = {};
                        result.id = swimlane.id;
                        result.name = swimlane.name;
                        var tasks = [];
                        var completeTask = [[], [], [], [], []];
                        var block = [];
                        angular.forEach(data.tasks, function (task) {
                            var result = {};
                            var typeCard = {};
                            var workflowStage = {};

                            angular.forEach(data.boardSettings.card_types, function (type) {
                                if (task.card_type_id == type.id) {
                                    typeCard = type;
                                }
                            }, typeCard);

                            angular.forEach(data.boardSettings.workflow_stages, function (stage) {
                                if (task.workflow_stage_id == stage.id) {
                                    workflowStage = stage;
                                }
                            }, workflowStage);

                            result.typeCard = {'id': typeCard.id, 'name': typeCard.name};
                            result.workflowStage = {'id': workflowStage.id, 'name': workflowStage.name};
                            result.created_at = task.created_at;
                            result.updated_at = task.updated_at;
                            result.name = task.name;


                            /* mesma lane, mesma semana[ && (moment(task.due_date).isoWeek() == moment(new Date()).isoWeek())] */
                            if ((task.swimlane_id == swimlane.id)) {
                                /* tarefas concluidas na semana */
                                if (result.workflowStage.name == 'Finalizados da Semana') {
                                    var date = moment(result.updated_at);
                                    completeTask[date.isoWeekday() - 1].push(result);
                                }

                                /* diferente de backlog mes e finalizado, card apenas do tipo normal*/
                                if (result.workflowStage.name != 'Backlog Mês' && result.workflowStage.name != 'Finalizado' && result.typeCard.name == "Normal") {
                                    tasks.push(result);
                                }
                            }

                            /* tarefas bloqueadas */
                            var taskBlock = {};
                            if((task.swimlane_id == swimlane.id) && task.block_reason && result.workflowStage.name != 'Finalizado'){
                                taskBlock = {
                                    block_reason: task.block_reason,
                                    name: task.name,
                                    updated_at: task.updated_at,
                                    author: swimlane.name
                                };
                                block.push(taskBlock);
                            }


                        }, tasks, completeTask, block);

                        result.completeTask = completeTask;
                        result.tasks = tasks;
                        $scope.swimlane = data.boardSettings.swimlanes;
                        $scope.result.push(result);
                        if(block.length > 0){
                            $scope.blockTasks.push(block);
                        }
                    });

                    if(privateLane){
                        $scope.goToPrivateLane();
                    } else {
                        $scope.goToTeamLane()
                    }

                    $scope.carregando = false;
                });
            };

            $scope.goToPrivateLane = function () {
                var result = $scope.result[0];
                var y = [];
                var avg = (result.tasks.length / 5);
                var i = avg;
                while (i <= result.tasks.length) {
                    i = i.toFixed(1);
                    y.push(parseFloat(i));
                    i = parseFloat(i) + parseFloat(avg);
                }
                var x = [];
                var taskFullForDay = 0;
                angular.forEach(result.completeTask, function (tasksForDay, index) {
                    if (index <= (moment(new Date()).isoWeekday() - 1)) {
                        taskFullForDay = taskFullForDay + tasksForDay.length;
                        x.push(taskFullForDay);
                    }
                });
                $scope.chartOptions.title.text = 'Burnup semanal - ' + result.name;
                $scope.chartOptions.series[0].data = y;
                $scope.chartOptions.series[1].data = x;

            };

            $scope.goToTeamLane = function () {
                var totalTasks = 0;
                var x = [null, null, null, null, null];
                angular.forEach($scope.result, function (result) {
                    totalTasks = totalTasks + result.tasks.length;
                    angular.forEach(result.completeTask, function (tasksForDay, index) {
                        if (index <= (moment(new Date()).isoWeekday() - 1)) {
                            x[index] = x[index] + tasksForDay.length;
                        }
                    });
                });
                number = 0;
                angular.forEach(x, function (value, index) {
                    if (index <= (moment(new Date()).isoWeekday() - 1)) {
                        number = number + value;
                        x[index] = number;
                    }
                });
                var y = [];
                var avg = (totalTasks / 5);
                var i = avg;
                while (i <= totalTasks) {
                    i = i.toFixed(1);
                    y.push(parseFloat(i));
                    i = parseFloat(i) + parseFloat(avg);
                }
                $scope.chartOptions.series[0].data = y;
                $scope.chartOptions.series[1].data = x;
            };

            $scope.getInfoBoard(false);
        }]);


module.factory('Api', function () {
    return KanbanTool.api = new KanbanTool.Api('xys', 'A1FB63LA654K');
});

module.service('getKanbanData', ['$q', 'Api', function ($q, ApiKanban) {
    return function () {
        return new $q(function (resolve, reject) {
            ApiKanban.getBoards(function (boards) {
                ApiKanban.getBoardSettings(boards[44].id, function (boardSettings) {
                    ApiKanban.getTasks(boards[44].id, function (tasks) {
                        resolve({'boards': boards, 'boardSettings': boardSettings, 'tasks': tasks});
                    });
                })
            });
        });
    };
}]);

module.directive('highChart', function () {
    return {
        restrict: 'E',
        template: '<div></div>',
        scope: {
            options: '='
        },
        link: function (scope, element) {
            Highcharts.chart(element[0], scope.options);
        }
    };
});