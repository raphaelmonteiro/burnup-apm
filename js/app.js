var module = angular.module('myApp', []);

module.controller('appController',
    ['$scope', 'Api', 'getKanbanData',
        function ($scope, ApiKanban, getKanbanData) {
            $scope.carregando = true;
            $scope.swimlane = [];
            $scope.form = {};
            $scope.result = [];
            $scope.blockTasks = [];
            $scope.repair = [];
            $scope.stages = [];

            $scope.chartOptions = {
                title: {
                    text: 'Burnup semanal - Equipe APM'
                },
                colors: ['blue', 'red'],
                yAxis: {
                    title: {
                        text: 'Cards finalizados'
                    }
                },
                xAxis: {
                    categories: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo']
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

            $scope.changeLaneForAllTeam = function () {
                $scope.form = {};
                $scope.getInfoBoard(false);
            };

            $scope.changeLane = function (lane) {
                $scope.form.swimlane = lane;
                $scope.getInfoBoard(true);
            };

            $scope.addSubtastk = function () {
                var analise = [
                    {"subtask[name]": "Webrequest", 'order': 1},
                    {"subtask[name]": "Errors", 'order': 2},
                    {"subtask[name]": "Exceptions", 'order': 3},
                    {"subtask[name]": "Client Errors", 'order': 4},
                    {"subtask[name]": "Database", 'order': 5},
                    {"subtask[name]": "Total Memory", 'order': 6},
                    {"subtask[name]": "Incidents", 'order': 7},
                    {"subtask[name]": "Transaction Flow", 'order': 8},
                    {"subtask[name]": "Runtime Suspensions", 'order': 9}
                ];

                getKanbanData().then(function (data) {
                    console.log(data);
                    angular.forEach(data.tasks, function (task) {
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

                        if (typeCard.name == "Normal" &&
                            (workflowStage.name != 'Finalizados da Semana' && workflowStage.name != 'Finalizado')) {
                            angular.forEach(analise, function (item) {
                                ApiKanban.createTaskSubtask(task.board_id, task.id, item, function (data) {
                                    console.log(data);
                                });
                            });
                        }
                    });
                });
            };

            $scope.colunmBoards = function (workflowStages) {
                $scope.stages = [];
                angular.forEach(workflowStages, function (stage) {
                    if (stage.name && (stage.name != 'Backlog Mês' && stage.name != 'Finalizado')) {
                        stage.count = 0;
                        $scope.stages.push(stage);
                    }
                })
            };

            $scope.getInfoBoard = function (privateLane) {
                $scope.carregando = true;
                $scope.result = [];
                $scope.blockTasks = [];
                $scope.repair = [];
                getKanbanData().then(function (data) {
                    $scope.colunmBoards(data.boardSettings.workflow_stages);
                    var swimlanes = $scope.form.swimlane ? [$scope.form.swimlane] : data.boardSettings.swimlanes;
                    angular.forEach(swimlanes, function (swimlane) {
                        var result = {};
                        result.id = swimlane.id;
                        result.name = swimlane.name;
                        var tasks = [];
                        var block = [];
                        var completeTask = [[], [], [], [], [], [], []];
                        if (data.tasks.length > 0) {
                            angular.forEach(data.tasks, function (task) {
                                if (task.due_date) {
                                    var due_date = moment(task.due_date, 'YYYY-MM-DD').toDate();
                                    var timestampDueDate = due_date.getTime();
                                    var now = new Date();
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

                                    result.swimlane = {'name': swimlane.name, 'id': swimlane.id};
                                    result.typeCard = {'id': typeCard.id, 'name': typeCard.name};
                                    result.workflowStage = {'id': workflowStage.id, 'name': workflowStage.name};
                                    result.created_at = task.created_at;
                                    result.updated_at = task.updated_at;
                                    result.name = task.name;

                                    if ((task.swimlane_id == swimlane.id) && (moment(timestampDueDate).isoWeek() == moment(now.getTime()).isoWeek()) &&
                                        (result.typeCard.name == "Normal" || result.typeCard.name == "Corrigir" || result.typeCard.name == "Impedimento")) {

                                        $scope.stagesCount(result);

                                        if (result.workflowStage.name == 'Finalizados da Semana') {
                                            var date = moment(result.updated_at);
                                            completeTask[date.isoWeekday() - 1].push(result);
                                        }

                                        if (result.workflowStage.name != 'Backlog Mês'
                                            && result.workflowStage.name != 'Finalizado') {
                                            tasks.push(result);
                                        }

                                        if (result.typeCard.name == "Corrigir") {
                                            $scope.repair.push(result);
                                        }
                                    }

                                    var taskBlock = {};
                                    if ((task.swimlane_id == swimlane.id)
                                        && task.block_reason && result.workflowStage.name != 'Finalizado') {
                                        taskBlock = {
                                            block_reason: task.block_reason,
                                            name: task.name,
                                            updated_at: task.updated_at,
                                            author: swimlane.name
                                        };
                                        block.push(taskBlock);
                                    }
                                }
                            }, tasks, completeTask, block);
                        }
                        result.completeTask = completeTask;
                        result.tasks = tasks;
                        $scope.swimlane = data.boardSettings.swimlanes;
                        $scope.result.push(result);
                        if (block.length > 0) {

                            angular.forEach(block, function (item) {
                                $scope.blockTasks.push(item);
                            });


                        }

                    });

                    if (privateLane) {
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
                    if (avg != 0) {
                        i = parseFloat(i) + parseFloat(avg);
                    } else {
                        break
                    }
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
                    if (avg != 0) {
                        i = parseFloat(i) + parseFloat(avg);
                    } else {
                        break
                    }
                }
                $scope.chartOptions.title.text = 'Burnup semanal - Equipe APM';
                $scope.chartOptions.series[0].data = y;
                $scope.chartOptions.series[1].data = x;
            };


            $scope.stagesCount = function (task) {
                angular.forEach($scope.stages, function (stage, index) {
                    if (stage.id == task.workflowStage.id) {
                        $scope.stages[index].count = $scope.stages[index].count + 1;
                    }
                })
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